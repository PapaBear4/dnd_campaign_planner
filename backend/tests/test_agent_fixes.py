import json
import os
import sys
import tempfile
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

backend_dir = Path(__file__).resolve().parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from app.db.database import init_db
from app.main import app
from app.models import NodeCreate, NodeUpdate
from app.services import graph_service, chat_history_service
from app.services.ai_agent_service import (
    _proto_to_python,
    _sanitize_gemini_history,
    _dispatch_tool_call,
)


@pytest.fixture
def client():
    return TestClient(app)


def test_proto_to_python_serialization():
    """Verify _proto_to_python converts protobuf and nested types into json-serializable dicts/lists."""
    import google.protobuf.struct_pb2 as struct_pb2

    s = struct_pb2.Struct()
    s.update({
        "scalar_list": ["a", "b"],
        "nested": {"key": "val"},
        "updates": [{"node_id": "n1", "confidence": 0.4, "lore_status": "rumor"}],
    })

    converted = _proto_to_python(s)
    # Must be 100% serializable by standard json.dumps without error
    dumped = json.dumps(converted)
    loaded = json.loads(dumped)

    assert loaded["scalar_list"] == ["a", "b"]
    assert loaded["nested"]["key"] == "val"
    assert loaded["updates"][0]["node_id"] == "n1"
    assert loaded["updates"][0]["confidence"] == 0.4
    assert loaded["updates"][0]["lore_status"] == "rumor"


def test_sanitize_gemini_history():
    """Verify _sanitize_gemini_history merges consecutive turns and extracts trailing user requests."""
    # Case 1: Normal alternating history
    normal = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there"},
    ]
    hist, leftover = _sanitize_gemini_history(normal)
    assert len(hist) == 2
    assert hist[0]["role"] == "user"
    assert hist[1]["role"] == "model"
    assert leftover == ""

    # Case 2: Consecutive user messages with trailing user (e.g. after a previous failed turn)
    broken = [
        {"role": "user", "content": "Audit lore"},
        {"role": "assistant", "content": "Here are 9 guilds"},
        {"role": "user", "content": "yes"},
    ]
    hist, leftover = _sanitize_gemini_history(broken)
    assert len(hist) == 2
    assert hist[0]["role"] == "user"
    assert hist[1]["role"] == "model"
    assert leftover == "yes"

    # Case 3: Empty content dropped
    with_empty = [
        {"role": "user", "content": "   "},
        {"role": "user", "content": "Actual query"},
        {"role": "assistant", "content": "Reply"},
    ]
    hist, leftover = _sanitize_gemini_history(with_empty)
    assert len(hist) == 2
    assert hist[0]["parts"] == ["Actual query"]


def test_node_confidence_and_lore_status_dispatch():
    """Verify _dispatch_tool_call correctly updates confidence and lore_status in SQLite."""
    from app.models import CampaignCreate
    camp = graph_service.create_campaign(CampaignCreate(name="Epistemic Test Campaign"))
    cid = camp.id

    # Create a node
    create_res = _dispatch_tool_call(
        "create_node",
        {
            "type": "encounter",
            "title": "Tavern Rumor Encounter",
            "summary": "Rumored goblin gathering",
            "confidence": 0.3,
            "lore_status": "rumor",
        },
        cid,
    )
    assert create_res.get("created") is True
    nid = create_res["node_id"]
    assert create_res["confidence"] == 0.3
    assert create_res["lore_status"] == "rumor"

    # Verify in DB
    db_node = graph_service.get_node(nid)
    assert db_node is not None
    assert db_node.confidence == 0.3
    assert db_node.lore_status == "rumor"

    # Update via update_node
    update_res = _dispatch_tool_call(
        "update_node",
        {
            "node_id": nid,
            "confidence": 0.75,
            "lore_status": "suspicion",
            "type": "quest",
        },
        cid,
    )
    assert update_res.get("updated") is True
    assert update_res["confidence"] == 0.75
    assert update_res["lore_status"] == "suspicion"
    assert update_res["type"] == "quest"

    # Verify update in DB
    updated_node = graph_service.get_node(nid)
    assert updated_node.confidence == 0.75
    assert updated_node.lore_status == "suspicion"
    assert updated_node.type == "quest"


def test_bulk_update_node_confidence():
    """Verify bulk_update_node_confidence updates multiple nodes in batch."""
    from app.models import CampaignCreate
    camp = graph_service.create_campaign(CampaignCreate(name="Bulk Conf Campaign"))
    cid = camp.id

    n1 = graph_service.create_node(
        NodeCreate(type="quest", title="Quest Alpha", campaign_id=cid, confidence=1.0, lore_status="fact"),
        default_campaign_id=cid,
    )
    n2 = graph_service.create_node(
        NodeCreate(type="quest", title="Quest Beta", campaign_id=cid, confidence=1.0, lore_status="fact"),
        default_campaign_id=cid,
    )

    # Bulk update via _dispatch_tool_call
    res = _dispatch_tool_call(
        "bulk_update_node_confidence",
        {
            "updates": [
                {"node_id": n1.id, "confidence": 0.4, "lore_status": "rumor"},
                {"node_id": n2.id, "confidence": 0.4, "lore_status": "rumor"},
            ]
        },
        cid,
    )

    assert res["updated_count"] == 2
    assert len(res["results"]) == 2

    # Check database
    updated_n1 = graph_service.get_node(n1.id)
    updated_n2 = graph_service.get_node(n2.id)
    assert updated_n1.confidence == 0.4
    assert updated_n1.lore_status == "rumor"
    assert updated_n2.confidence == 0.4
    assert updated_n2.lore_status == "rumor"


def test_chat_history_safe_json_serialization():
    """Verify save_message handles non-standard and complex nested objects without throwing TypeError."""
    from app.models import CampaignCreate
    camp = graph_service.create_campaign(CampaignCreate(name="Serialization Campaign"))
    cid = camp.id

    class CustomObject:
        def __str__(self):
            return "custom_str_repr"

    thread = chat_history_service.create_thread(cid, "Serialization Test")
    tid = thread["id"]

    # Pass non-serializable objects inside actions_taken
    msg = chat_history_service.save_message(
        thread_id=tid,
        campaign_id=cid,
        role="assistant",
        content="Test reply",
        actions_taken=[{"tool": "custom", "obj": CustomObject()}],
        loop_steps=[{"step": 1, "obj": CustomObject()}],
    )
    assert msg["id"] is not None
    assert msg["content"] == "Test reply"


def test_agent_node_reordering_tools():
    """Verify create_node, update_node, and reorder_nodes handle sort_order in agent tool dispatch."""
    from app.models import CampaignCreate
    camp = graph_service.create_campaign(CampaignCreate(name="Reorder Test Campaign"))
    cid = camp.id

    # 1. Create nodes with initial sort_order
    res1 = _dispatch_tool_call(
        "create_node",
        {"type": "quest", "title": "Quest 1", "sort_order": 10},
        cid,
    )
    assert res1["created"] is True
    assert res1["sort_order"] == 10
    n1_id = res1["node_id"]

    res2 = _dispatch_tool_call(
        "create_node",
        {"type": "quest", "title": "Quest 2", "sort_order": 20},
        cid,
    )
    assert res2["created"] is True
    assert res2["sort_order"] == 20
    n2_id = res2["node_id"]

    # 2. Update node sort_order directly
    res_upd = _dispatch_tool_call(
        "update_node",
        {"node_id": n1_id, "sort_order": 50},
        cid,
    )
    assert res_upd["updated"] is True
    assert res_upd["sort_order"] == 50
    assert graph_service.get_node(n1_id).sort_order == 50

    # 3. Use reorder_nodes tool to swap order (n2 first, then n1)
    res_reorder = _dispatch_tool_call(
        "reorder_nodes",
        {"node_ids": [n2_id, n1_id]},
        cid,
    )
    assert res_reorder["reordered"] is True
    assert res_reorder["count"] == 2
    assert graph_service.get_node(n2_id).sort_order == 10
    assert graph_service.get_node(n1_id).sort_order == 20


def test_token_efficient_database_context():
    """Verify build_campaign_database_context produces a compact, capped summary even with many nodes."""
    from app.models import CampaignCreate, NodeCreate
    from app.services.ai_agent_service import build_campaign_database_context
    camp = graph_service.create_campaign(CampaignCreate(name="Token Test Campaign", setting="Faerun"))
    cid = camp.id

    # Create 1 Arc, 12 Quests, 20 NPCs, 15 Locations
    graph_service.create_node(NodeCreate(type="arc", title="Arc 1: Rising Shadows", campaign_id=cid), default_campaign_id=cid)
    for i in range(12):
        graph_service.create_node(
            NodeCreate(type="quest", title=f"Quest {i+1}", campaign_id=cid, data_json={"status": "active" if i < 3 else "planned"}),
            default_campaign_id=cid,
        )
    for i in range(20):
        graph_service.create_node(
            NodeCreate(type="npc", title=f"Townsperson {i+1}", campaign_id=cid),
            default_campaign_id=cid,
        )
    for i in range(15):
        graph_service.create_node(
            NodeCreate(type="location", title=f"Crypt Room {i+1}", campaign_id=cid),
            default_campaign_id=cid,
        )

    ctx = build_campaign_database_context(cid)

    # Must contain high-level metrics
    assert "Active Campaign Overview" in ctx
    assert "Token Test Campaign" in ctx
    assert "Faerun" in ctx
    assert "Total Entities" in ctx
    assert "Arc 1: Rising Shadows" in ctx
    # Must cap quests to 8 and show overflow note
    assert "Showing 8 of 12" in ctx
    assert "(+ 4 more quests indexed" in ctx
    # Must NOT vomit 20 NPCs or 15 Locations into the text
    assert "Townsperson 19" not in ctx
    assert "Crypt Room 14" not in ctx
    # Must include the on-demand query directive
    assert "On-Demand Graph Discovery" in ctx
    assert "search_nodes" in ctx


