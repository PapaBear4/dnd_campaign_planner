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
