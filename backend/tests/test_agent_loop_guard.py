import json
from pathlib import Path
import sys
import pytest

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.services.ai_agent_service import (
    AgentLoopGuard,
    _sanitize_and_truncate_tool_result,
    DEFAULT_MAX_TURNS,
    DEFAULT_MAX_TOKENS,
)


def test_loop_guard_repetition_detection():
    """Verify AgentLoopGuard intercepts identical repeated tool calls."""
    guard = AgentLoopGuard(max_turns=25, repeat_window=4, repeat_threshold=2)

    # First call to search_nodes with specific args: allowed
    is_blocked, msg = guard.check_tool_call("search_nodes", {"title_fragment": "goblin"})
    assert not is_blocked
    assert msg is None

    # Immediate consecutive identical call: blocked!
    is_blocked, msg = guard.check_tool_call("search_nodes", {"title_fragment": "goblin"})
    assert is_blocked
    assert "Loop Prevention Warning" in msg
    assert guard.loop_warnings_count == 1
    assert guard.consecutive_loop_interventions == 1

    # Next call with DIFFERENT query: allowed
    is_blocked, msg = guard.check_tool_call("search_nodes", {"title_fragment": "dragon"})
    assert not is_blocked
    assert guard.consecutive_loop_interventions == 0


def test_loop_guard_allows_scratchpad_repetition():
    """Scratchpad updates are intermediate working memory and should not be blocked."""
    guard = AgentLoopGuard(max_turns=25)
    is_blocked1, _ = guard.check_tool_call("update_scratchpad", {"notes": "Step 1"})
    assert not is_blocked1
    is_blocked2, _ = guard.check_tool_call("update_scratchpad", {"notes": "Step 2"})
    assert not is_blocked2


def test_loop_guard_forced_stop_on_repeated_interventions():
    """Verify that multiple consecutive loop warnings force final synthesis."""
    guard = AgentLoopGuard(max_turns=25)

    guard.check_tool_call("get_node_detail", {"node_id": "n1"})
    guard.check_tool_call("get_node_detail", {"node_id": "n1"}) # blocked 1
    guard.check_tool_call("get_node_detail", {"node_id": "n1"}) # blocked 2

    stop_forced, reason = guard.should_force_stop()
    assert stop_forced
    assert "Repeated consecutive identical tool calls" in reason


def test_loop_guard_stagnation_nudge():
    """Verify stagnation nudge triggers after threshold read-only turns without state writes."""
    guard = AgentLoopGuard(max_turns=25, max_stagnant_reads=3)

    nudge1 = guard.update_turn_activity(["search_nodes"], turn=0)
    assert nudge1 is None

    nudge2 = guard.update_turn_activity(["get_node_detail"], turn=1)
    assert nudge2 is None

    nudge3 = guard.update_turn_activity(["traverse_graph"], turn=2)
    assert nudge3 is not None
    assert "Pacing Notice: You have completed 3 consecutive read-only turns" in nudge3

    # Writing resets the count
    guard.update_turn_activity(["create_node"], turn=3)
    assert guard.read_only_turns_count == 0


def test_loop_guard_token_budget_ceiling():
    """Verify AgentLoopGuard triggers when token usage metadata hits limit."""
    guard = AgentLoopGuard(max_turns=25, max_tokens=50_000)

    class MockUsage:
        total_token_count = 35_000

    class MockResponse:
        usage_metadata = MockUsage()

    exceeded, tokens = guard.record_turn_tokens(MockResponse())
    assert not exceeded
    assert tokens == 35_000

    MockUsage.total_token_count = 55_000
    exceeded, tokens = guard.record_turn_tokens(MockResponse())
    assert exceeded
    assert tokens == 55_000
    assert "Token budget exceeded" in guard.stop_reason


def test_loop_guard_pacing_meta():
    """Verify pacing metadata generates correct countdown and urgency notices."""
    guard = AgentLoopGuard(max_turns=20)

    meta_early = guard.get_pacing_meta(turn=5)
    assert meta_early["turn"] == 6
    assert meta_early["turns_remaining"] == 14
    assert "urgency" not in meta_early

    meta_late = guard.get_pacing_meta(turn=18)
    assert meta_late["turn"] == 19
    assert meta_late["turns_remaining"] == 1
    assert "CRITICAL: Only 1 turn(s) remaining" in meta_late["urgency"]


def test_sanitize_and_truncate_tool_result():
    """Verify tool output sanitizer caps oversized payloads to protect context budget."""
    small_payload = {"status": "ok", "nodes": [{"id": 1}, {"id": 2}]}
    cleaned_small = _sanitize_and_truncate_tool_result(small_payload, max_chars=4000)
    assert cleaned_small == small_payload

    # Huge payload with 30 items
    huge_nodes = [{"id": f"node_{i}", "title": f"Quest Node {i}", "text": "x" * 200} for i in range(30)]
    huge_payload = {"nodes": huge_nodes, "count": 30}

    cleaned_huge = _sanitize_and_truncate_tool_result(huge_payload, max_chars=1000)
    assert len(cleaned_huge["nodes"]) <= 6
    assert "_nodes_truncated" in cleaned_huge
    assert "Showing 6 of 30 items" in cleaned_huge["_nodes_truncated"]
