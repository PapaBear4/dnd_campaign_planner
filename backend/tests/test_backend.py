import os
import tempfile
import pytest
from fastapi.testclient import TestClient

# Create a temporary test database
test_db = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
test_db_path = test_db.name
test_db.close()
os.environ["DATABASE_PATH"] = test_db_path

from app.db.database import init_db
from app.main import app
from app.models import CampaignCreate, EdgeCreate, NodeCreate, NodeUpdate
from app.services import graph_service

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()
    yield
    if os.path.exists(test_db_path):
        os.remove(test_db_path)

@pytest.fixture
def client():
    return TestClient(app)

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_campaign_crud():
    campaign = graph_service.create_campaign(
        CampaignCreate(name="Curse of the Shadow Dragon", setting="Shadowfell")
    )
    assert campaign.id is not None
    assert campaign.name == "Curse of the Shadow Dragon"

    retrieved = graph_service.get_campaign(campaign.id)
    assert retrieved is not None
    assert retrieved.setting == "Shadowfell"

def test_node_crud_and_revelation():
    campaign = graph_service.create_campaign(
        CampaignCreate(name="Lost Mines Test", setting="Sword Coast")
    )
    cid = campaign.id

    # Create secret DM node
    secret_node = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="clue",
            title="Secret Cult Ledger",
            summary="A blood-stained ledger with cultist names.",
            content_markdown="Found in the study.",
            revealed_to_players=False
        ),
        default_campaign_id=cid
    )

    # Create public / revealed node
    tavern_node = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="location",
            title="The Drunken Dragon Inn",
            summary="A bustling tavern at the crossroads.",
            revealed_to_players=True
        ),
        default_campaign_id=cid
    )

    # Verify DM gets both nodes
    dm_nodes = graph_service.list_nodes(cid, revealed_only=False)
    dm_titles = [n.title for n in dm_nodes]
    assert "Secret Cult Ledger" in dm_titles
    assert "The Drunken Dragon Inn" in dm_titles

    # Verify Player mode only gets the revealed node
    player_nodes = graph_service.list_nodes(cid, revealed_only=True)
    player_titles = [n.title for n in player_nodes]
    assert "The Drunken Dragon Inn" in player_titles
    assert "Secret Cult Ledger" not in player_titles

    # Reveal the secret node
    graph_service.update_node(secret_node.id, NodeUpdate(revealed_to_players=True))
    player_nodes_after = graph_service.list_nodes(cid, revealed_only=True)
    player_titles_after = [n.title for n in player_nodes_after]
    assert "Secret Cult Ledger" in player_titles_after

def test_edges_and_hierarchy():
    campaign = graph_service.create_campaign(
        CampaignCreate(name="Hierarchy Campaign", setting="Faerûn")
    )
    cid = campaign.id

    # Create Arc -> Quest -> Session
    arc = graph_service.create_node(
        NodeCreate(campaign_id=cid, type="arc", title="Act I: The Awakening"),
        default_campaign_id=cid
    )
    quest = graph_service.create_node(
        NodeCreate(campaign_id=cid, type="quest", title="Investigate the Crypt"),
        default_campaign_id=cid
    )
    session = graph_service.create_node(
        NodeCreate(campaign_id=cid, type="session", title="Session 1: Into the Dark"),
        default_campaign_id=cid
    )

    # Connect with contains relations
    graph_service.create_edge(
        EdgeCreate(
            campaign_id=cid,
            source_id=arc.id,
            target_id=quest.id,
            relation_type="contains"
        ),
        default_campaign_id=cid
    )
    graph_service.create_edge(
        EdgeCreate(
            campaign_id=cid,
            source_id=quest.id,
            target_id=session.id,
            relation_type="contains"
        ),
        default_campaign_id=cid
    )

    tree = graph_service.get_hierarchy_tree(cid)
    assert len(tree) >= 1
    arc_item = next(item for item in tree if item.node.id == arc.id)
    assert len(arc_item.children) == 1
    assert arc_item.children[0].node.id == quest.id
    assert len(arc_item.children[0].children) == 1
    assert arc_item.children[0].children[0].node.id == session.id

def test_fts5_search():
    campaign = graph_service.create_campaign(
        CampaignCreate(name="Search Campaign")
    )
    cid = campaign.id

    graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="monster",
            title="Necrotic Beholder",
            summary="A terrifying floating aberration with decaying eye stalks.",
            content_markdown="Special ability: Antimagic Decay Cone."
        ),
        default_campaign_id=cid
    )

    results = graph_service.search_nodes(cid, "aberration")
    assert len(results) > 0
    assert results[0].title == "Necrotic Beholder"

def test_agent_routes(client):
    # Test Boxed Text generation (offline fallback)
    resp = client.post("/api/agent/boxed-text", json={
        "location_title": "The Whispering Crypt",
        "mood": "eerie and chilled",
        "sensory_details": "scent of ozone and stale incense"
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "boxed_text" in data
    assert "The Whispering Crypt" in data["boxed_text"]
    assert "dm_roleplay_cues" in data

    # Test GM Coach advice
    coach_resp = client.post("/api/agent/coach", json={
        "situation": "Players ignored the dungeon entrance and decided to scale the jagged cliff",
        "challenge_type": "fail_forward"
    })
    assert coach_resp.status_code == 200
    assert "advice" in coach_resp.json()

    # Test Weave Hook
    hook_resp = client.post("/api/agent/weave-hook", json={
        "pc_name": "Valeros",
        "pc_backstory": "Former mercenary betrayed by his former commander"
    })
    assert hook_resp.status_code == 200
    assert "Valeros" in hook_resp.json()["hook_title"]

    # Test Adventure Decomposer
    decomp_resp = client.post("/api/agent/decompose", json={
        "text_content": "Chapter 1: The Sunken Fortress. Deep within the ravine lies an ancient citadel.",
        "instruction": "Decompose into Chapter Arc and Quests",
        "decomposition_mode": "campaign_structure"
    })
    assert decomp_resp.status_code == 200
    decomp_data = decomp_resp.json()
    assert "overview_summary" in decomp_data
    assert "extracted_nodes" in decomp_data

    # Test Session Transcript Adaptation
    adapt_resp = client.post("/api/agent/adapt-session", json={
        "transcript_text": "The party navigated Session 1 descent, defeated the ravine rat ambush, and spoke kindly to Meepo.",
        "instruction": "Adapt campaign graph to session fallout"
    })
    assert adapt_resp.status_code == 200
    adapt_data = adapt_resp.json()
    assert "session_recap" in adapt_data
    assert "status_updates" in adapt_data
    assert "next_session_proposal" in adapt_data

    # Test Applying Session Adaptation
    apply_resp = client.post("/api/agent/apply-session-adaptation", json={
        "campaign_id": "default-campaign",
        "status_updates": adapt_data.get("status_updates", []),
        "node_updates": adapt_data.get("node_updates", []),
        "new_nodes": adapt_data.get("new_nodes", []),
        "new_edges": adapt_data.get("new_edges", []),
        "next_session_node": adapt_data.get("next_session_proposal"),
        "player_note": adapt_data.get("player_portal_note")
    })
    assert apply_resp.status_code == 200
    assert apply_resp.json()["status"] == "applied"


def test_player_portal_endpoints(client):
    # Create a test node via API
    node_resp = client.post("/api/nodes", json={
        "type": "location",
        "title": "Sunken Citadel Entrance",
        "summary": "Old stone steps leading into the rift.",
        "revealed_to_players": True
    })
    assert node_resp.status_code == 200

    # Verify player graph endpoint returns this node
    pg_resp = client.get("/api/player/graph")
    assert pg_resp.status_code == 200
    p_titles = [n["title"] for n in pg_resp.json()["nodes"]]
    assert "Sunken Citadel Entrance" in p_titles

    # Create player note
    note_resp = client.post("/api/player/notes", json={
        "author_name": "Thorin (Dwarf Cleric)",
        "title": "Clues about the goblins",
        "content": "The goblins were carrying white apple seeds."
    })
    assert note_resp.status_code == 200
    note_id = note_resp.json()["id"]

    # Read back player notes
    notes_list = client.get("/api/player/notes")
    assert notes_list.status_code == 200
    assert any(n["id"] == note_id for n in notes_list.json())

def test_settings_routes(client):
    get_resp = client.get("/api/settings")
    assert get_resp.status_code == 200
    assert "gemini_model" in get_resp.json()

    # Update model
    put_resp = client.put("/api/settings", json={
        "gemini_model": "gemini-2.5-pro"
    })
    assert put_resp.status_code == 200
    assert put_resp.json()["gemini_model"] == "gemini-2.5-pro"

def test_query_models_endpoint(client):
    # Test without api key (fallback models)
    resp = client.post("/api/settings/models", json={"api_key": ""})
    assert resp.status_code == 200
    data = resp.json()
    assert "models" in data
    assert len(data["models"]) > 0
    model_ids = [m["id"] for m in data["models"]]
    assert "gemini-2.5-flash" in model_ids

    # Test GET endpoint
    get_resp = client.get("/api/settings/models")
    assert get_resp.status_code == 200
    assert "models" in get_resp.json()

def test_uploads_library_and_duplicate_handling(client):
    import io

    # 1. Upload new file
    file_bytes = io.BytesIO(b"D&D Adventure Chapter 1 content")
    upload_resp = client.post(
        "/api/uploads",
        files={"file": ("sunless_citadel_ch1.pdf", file_bytes, "application/pdf")},
        data={"category": "pdf", "campaign_id": "default-campaign"}
    )
    assert upload_resp.status_code == 200
    doc_data = upload_resp.json()
    assert doc_data["original_name"] == "sunless_citadel_ch1.pdf"
    assert doc_data["is_replacement"] is False
    stored_filename = doc_data["filename"]

    # 2. Duplicate check
    dup_resp = client.get("/api/uploads/check-duplicate?filename=sunless_citadel_ch1.pdf&campaign_id=default-campaign")
    assert dup_resp.status_code == 200
    dup_data = dup_resp.json()
    assert dup_data["exists"] is True
    assert dup_data["existing_file"]["filename"] == stored_filename

    # 3. List documents in library
    list_resp = client.get("/api/uploads?campaign_id=default-campaign&category=pdf")
    assert list_resp.status_code == 200
    docs = list_resp.json()
    assert any(d["filename"] == stored_filename for d in docs)

    # 4. Replace file
    file_v2 = io.BytesIO(b"D&D Adventure Chapter 1 content - Updated & Expanded")
    replace_resp = client.post(
        "/api/uploads",
        files={"file": ("sunless_citadel_ch1.pdf", file_v2, "application/pdf")},
        data={"category": "pdf", "campaign_id": "default-campaign", "replace": "true"}
    )
    assert replace_resp.status_code == 200
    rep_data = replace_resp.json()
    assert rep_data["is_replacement"] is True
    assert rep_data["filename"] == stored_filename

    # 5. Delete document
    del_resp = client.delete(f"/api/uploads/{stored_filename}")
    assert del_resp.status_code == 200
    assert del_resp.json()["success"] is True

    # 6. Verify duplicate check returns false after deletion
    dup_after = client.get("/api/uploads/check-duplicate?filename=sunless_citadel_ch1.pdf&campaign_id=default-campaign")
    assert dup_after.status_code == 200
    assert dup_after.json()["exists"] is False



