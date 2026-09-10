import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db.database import init_db
from app.services import graph_service
from app.services.ai_agent_service import _reconcile_extracted_nodes_with_campaign
from app.models import CampaignCreate, NodeCreate

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_campaign():
    init_db()
    c = graph_service.create_campaign(
        CampaignCreate(name="Deconfliction Test Campaign", setting="Sunless Citadel")
    )
    graph_service.set_setting("active_campaign_id", c.id)
    yield c.id

def test_reconcile_exact_match(setup_campaign):
    cid = setup_campaign
    # Create canonical existing node
    existing = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="npc",
            title="Yusdrayl",
            subtitle="Kobold Queen",
            summary="Ruler of the Sunless Citadel kobolds.",
            content_markdown="Original canon lore: Yusdrayl sits on the dragon throne.",
            data_json={"disposition": "neutral", "cr": "1"}
        ),
        default_campaign_id=cid
    )

    # Reconcile extracted node with exact title
    extracted = [{
        "type": "npc",
        "title": "Yusdrayl",
        "summary": "Imported NPC description",
        "content_markdown": "Module stats: She wields a wand of magic missiles.",
        "data_json": {"disposition": "neutral", "cr": "1", "hp": 16}
    }]

    reconciled = _reconcile_extracted_nodes_with_campaign(extracted, cid)
    assert len(reconciled) == 1
    assert reconciled[0]["match_status"] == "exact_match"
    assert reconciled[0]["match_confidence"] == 1.0
    assert reconciled[0]["matched_node_id"] == existing.id
    assert reconciled[0]["matched_node_title"] == "Yusdrayl"

def test_reconcile_conflict_detection(setup_campaign):
    cid = setup_campaign
    # Existing node with CR 2 and friendly disposition
    existing = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="monster",
            title="Calcryx",
            subtitle="White Dragon Wyrmling",
            summary="The captured white dragon.",
            content_markdown="Protected pet of the clan.",
            data_json={"cr": "2", "disposition": "friendly"}
        ),
        default_campaign_id=cid
    )

    # Extracted entity with contradictory CR 4 and hostile disposition
    extracted = [{
        "type": "monster",
        "title": "Calcryx",
        "data_json": {"cr": "4", "disposition": "hostile"}
    }]

    reconciled = _reconcile_extracted_nodes_with_campaign(extracted, cid)
    assert len(reconciled) == 1
    assert reconciled[0]["match_status"] == "conflict"
    assert "CR conflict" in reconciled[0]["conflict_reason"]
    assert "Disposition conflict" in reconciled[0]["conflict_reason"]
    assert reconciled[0]["matched_node_id"] == existing.id

def test_reconcile_potential_match(setup_campaign):
    cid = setup_campaign
    # Existing node: "Zarr"
    existing = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="npc",
            title="Zarr",
            subtitle="Goblin Raider",
            summary="A vicious scout.",
            data_json={"role": "villain"}
        ),
        default_campaign_id=cid
    )

    # Extracted entity: "Captain Zarr"
    extracted = [{
        "type": "npc",
        "title": "Captain Zarr",
        "summary": "Leader of the northern watch."
    }]

    reconciled = _reconcile_extracted_nodes_with_campaign(extracted, cid)
    assert len(reconciled) == 1
    assert reconciled[0]["match_status"] == "potential_match"
    assert reconciled[0]["match_confidence"] >= 0.70
    assert reconciled[0]["matched_node_id"] == existing.id
    assert reconciled[0]["matched_node_title"] == "Zarr"

def test_lossless_merge_via_apply_extracted(setup_campaign):
    cid = setup_campaign
    # Create canonical node
    canon_node = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="npc",
            title="Meepo",
            subtitle="Keeper of Dragons",
            summary="Original canon summary.",
            content_markdown="Canon background: Meepo was born in the deep caves.",
            data_json={"disposition": "friendly", "ac": 12},
            is_canon=True
        ),
        default_campaign_id=cid
    )

    # Apply extracted with action='merge'
    res = client.post("/api/agent/apply-extracted", json={
        "campaign_id": cid,
        "nodes": [{
            "type": "npc",
            "title": "Meepo",
            "action": "merge",
            "merge_target_id": canon_node.id,
            "content_markdown": "Module lore: Has key to room 15.",
            "data_json": {"ac": 10, "hp": 7, "speed": "30ft"}  # ac is already 12 in canon, should preserve 12
        }],
        "edges": []
    })

    assert res.status_code == 200
    data = res.json()
    assert data["nodes_merged"] == 1

    # Verify lossless preservation
    updated = graph_service.get_node(canon_node.id)
    assert "Canon background: Meepo was born in the deep caves." in updated.content_markdown
    assert "Module lore: Has key to room 15." in updated.content_markdown
    assert "Imported Module Notes" in updated.content_markdown
    assert updated.data_json["ac"] == 12  # Canon value preserved
    assert updated.data_json["hp"] == 7   # New field filled
    assert updated.data_json["speed"] == "30ft"
    assert updated.summary == "Original canon summary."

def test_apply_extracted_separate_record(setup_campaign):
    cid = setup_campaign
    # Even if titles match, if action='create', create as separate record
    existing = graph_service.create_node(
        NodeCreate(campaign_id=cid, type="quest", title="Sunken Citadel Expedition"),
        default_campaign_id=cid
    )

    res = client.post("/api/agent/apply-extracted", json={
        "campaign_id": cid,
        "nodes": [{
            "type": "quest",
            "title": "Sunken Citadel Expedition",
            "action": "create",
            "summary": "Alternative version of quest."
        }],
        "edges": []
    })

    assert res.status_code == 200
    data = res.json()
    assert data["nodes_created"] == 1
    assert data["nodes_merged"] == 0

    all_nodes = graph_service.list_nodes(cid)
    matching = [n for n in all_nodes if n.title == "Sunken Citadel Expedition"]
    assert len(matching) == 2
