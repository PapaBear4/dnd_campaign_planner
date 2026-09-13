import json
from unittest.mock import MagicMock, patch
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import CampaignCreate, NodeCreate
from app.services import graph_service, map_vision_service
from app.services.ai_agent_service import _dispatch_tool_call

client = TestClient(app)


@pytest.fixture
def setup_campaign_with_map():
    camp = graph_service.create_campaign(CampaignCreate(name="Map Vision Test Campaign"))
    cid = camp.id

    # Create an existing location in the campaign
    existing_loc = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="location",
            title="Area 1: Fortress Gate",
            summary="Iron reinforced gate entrance",
            is_canon=True,
            data_json={"room_number": "1"},
        ),
        default_campaign_id=cid,
    )

    # Create a map node
    map_node = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="map",
            title="Citadel Upper Level",
            summary="Battle map of the upper ruin",
            data_json={
                "map_url": "/api/uploads/test-map.png",
                "pins": [],
            },
        ),
        default_campaign_id=cid,
    )

    return {"campaign_id": cid, "location": existing_loc, "map": map_node}


def test_resolve_map_image_path(tmp_path, monkeypatch):
    test_file = tmp_path / "test-dungeon.png"
    test_file.write_text("fake-image-content")

    monkeypatch.setattr(map_vision_service, "UPLOAD_DIR", tmp_path)

    # Test resolution with /api/uploads/
    resolved = map_vision_service.resolve_map_image_path("/api/uploads/test-dungeon.png")
    assert resolved is not None
    assert resolved.name == "test-dungeon.png"

    # Test direct path
    assert map_vision_service.resolve_map_image_path(str(test_file)) == test_file


def test_find_matching_campaign_node(setup_campaign_with_map):
    loc = setup_campaign_with_map["location"]
    candidates = [loc]

    # Match by room number '1'
    matched = map_vision_service._find_matching_campaign_node("Entrance Area", "1", candidates)
    assert matched is not None
    assert matched.id == loc.id

    # Match by title fragment 'Fortress Gate'
    matched_title = map_vision_service._find_matching_campaign_node("Fortress Gate", None, candidates)
    assert matched_title is not None
    assert matched_title.id == loc.id

    # Non-matching
    no_match = map_vision_service._find_matching_campaign_node("Dragon Tomb", "99", candidates)
    assert no_match is None


def test_place_single_map_pin_existing_node(setup_campaign_with_map):
    cid = setup_campaign_with_map["campaign_id"]
    map_node = setup_campaign_with_map["map"]
    loc = setup_campaign_with_map["location"]

    res = map_vision_service.place_single_map_pin(
        map_id=map_node.id,
        campaign_id=cid,
        label="Fortress Gate Pin",
        x=25.5,
        y=75.0,
        node_id=loc.id,
        revealed=True,
    )

    assert res["success"] is True
    assert res["node_id"] == loc.id
    assert res["x"] == 25.5
    assert res["y"] == 75.0

    # Verify persisted in SQLite
    updated_map = graph_service.get_node(map_node.id)
    pins = updated_map.data_json.get("pins", [])
    assert len(pins) == 1
    assert pins[0]["nodeId"] == loc.id
    assert pins[0]["x"] == 25.5


def test_place_single_map_pin_new_draft_location(setup_campaign_with_map):
    cid = setup_campaign_with_map["campaign_id"]
    map_node = setup_campaign_with_map["map"]

    res = map_vision_service.place_single_map_pin(
        map_id=map_node.id,
        campaign_id=cid,
        label="Area 4: Guard Barracks",
        x=45.0,
        y=60.0,
        node_id=None,  # No existing node -> should create draft location
        revealed=False,
    )

    assert res["success"] is True
    new_node_id = res["node_id"]
    assert new_node_id is not None

    # Check the created node
    created_loc = graph_service.get_node(new_node_id)
    assert created_loc is not None
    assert created_loc.type == "location"
    assert created_loc.title == "Area 4: Guard Barracks"
    assert created_loc.is_canon is False  # Must be draft!

    # Check edge: map contains new_loc
    edges = graph_service.list_edges_for_node(cid, map_node.id)
    contains_edge = next((e for e in edges if e["target_id"] == new_node_id and e["relation_type"] == "contains"), None)
    assert contains_edge is not None


def test_apply_map_scan_results(setup_campaign_with_map):
    cid = setup_campaign_with_map["campaign_id"]
    map_node = setup_campaign_with_map["map"]
    existing_loc = setup_campaign_with_map["location"]

    pins = [
        {"id": "pin-1", "nodeId": existing_loc.id, "label": existing_loc.title, "x": 20.0, "y": 30.0, "revealed": True},
        {"id": "pin-2", "nodeId": "temp-loc-2", "label": "Area 2: Hall of Heroes", "x": 40.0, "y": 30.0, "revealed": False},
    ]
    new_nodes = [
        {
            "temp_id": "temp-loc-2",
            "type": "location",
            "title": "Area 2: Hall of Heroes",
            "summary": "Statues of ancient dwarven warriors",
            "is_canon": False,
            "data_json": {"room_number": "2"},
        }
    ]
    new_edges = [
        {
            "source_id": existing_loc.id,
            "target_id": "temp-loc-2",
            "relation_type": "leads_to",
            "label": "Arched stone corridor",
            "is_canon": False,
        }
    ]

    res = map_vision_service.apply_map_scan_results(
        map_id=map_node.id,
        campaign_id=cid,
        pins=pins,
        new_nodes=new_nodes,
        new_edges=new_edges,
    )

    assert res["success"] is True
    assert res["new_nodes_created"] == 1
    assert res["new_edges_created"] == 1

    # Verify map node has 2 pins
    updated_map = graph_service.get_node(map_node.id)
    saved_pins = updated_map.data_json.get("pins", [])
    assert len(saved_pins) == 2

    # Verify the real node ID replaced temp-loc-2
    real_pin_2 = next(p for p in saved_pins if p["x"] == 40.0)
    assert not real_pin_2["nodeId"].startswith("temp-")


def test_agent_tool_dispatch_place_map_pin(setup_campaign_with_map):
    cid = setup_campaign_with_map["campaign_id"]
    map_node = setup_campaign_with_map["map"]

    args = {
        "map_id": map_node.id,
        "label": "Dragon Vault",
        "x": 88.0,
        "y": 12.5,
        "revealed": True,
    }
    dispatch_res = _dispatch_tool_call("place_map_pin", args, cid)
    assert dispatch_res.get("success") is True
    assert dispatch_res.get("label") == "Dragon Vault"


def test_api_place_pin_and_apply_scan(setup_campaign_with_map):
    cid = setup_campaign_with_map["campaign_id"]
    map_node = setup_campaign_with_map["map"]

    # Test /api/agent/map/place-pin
    res = client.post(
        "/api/agent/map/place-pin",
        json={
            "map_id": map_node.id,
            "campaign_id": cid,
            "label": "Secret Armory",
            "x": 33.3,
            "y": 66.7,
            "revealed": False,
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["success"] is True
    assert data["label"] == "Secret Armory"

    # Test /api/agent/map/apply-scan
    apply_res = client.post(
        "/api/agent/map/apply-scan",
        json={
            "map_id": map_node.id,
            "campaign_id": cid,
            "pins": [{"id": "p-test", "nodeId": data["node_id"], "label": "Secret Armory", "x": 35.0, "y": 67.0}],
        },
    )
    assert apply_res.status_code == 200
    assert apply_res.json()["success"] is True
