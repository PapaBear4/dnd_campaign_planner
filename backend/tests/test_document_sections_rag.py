import pytest
from app.db.database import init_db, get_db
from app.services import pdf_service, graph_service, ai_agent_service
from app.models import NodeCreate

@pytest.fixture(autouse=True)
def setup_test_env():
    init_db()
    cid = "test-rag-campaign"
    with get_db() as conn:
        conn.execute("INSERT OR IGNORE INTO campaigns (id, name, description, created_at, updated_at) VALUES (?, ?, ?, datetime('now'), datetime('now'))",
                     (cid, "Test RAG Campaign", "Testing document sections RAG"))
        conn.execute("DELETE FROM uploaded_document_sections WHERE campaign_id = ?", (cid,))
        conn.execute("DELETE FROM nodes WHERE campaign_id = ?", (cid,))
    yield cid

def test_document_sections_storage_and_fts(setup_test_env):
    cid = setup_test_env
    doc_id = "test-doc-1.pdf"
    
    # Insert parent uploaded_documents record
    with get_db() as conn:
        conn.execute("""
            INSERT OR IGNORE INTO uploaded_documents (id, campaign_id, filename, original_name, category, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'pdf', datetime('now'), datetime('now'))
        """, (doc_id, cid, doc_id, doc_id))
        conn.execute("""
            INSERT INTO uploaded_document_sections (id, document_id, campaign_id, section_title, page_number, raw_text, chunk_index, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, ("sec-1", doc_id, cid, "Area 1: The Courtyard", 1, "The courtyard is overgrown with briars. Three giant rats scurry behind fallen masonry.", 0))
        conn.execute("""
            INSERT INTO uploaded_document_sections (id, document_id, campaign_id, section_title, page_number, raw_text, chunk_index, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        """, ("sec-2", doc_id, cid, "Area 2: Dragon Shrine", 2, "A secret door to the north requires a DC 15 Perception check to spot. Trapped with poison needle.", 0))

    # Test FTS search
    results_rat = pdf_service.search_document_sections("rats", document_id=doc_id, campaign_id=cid)
    assert len(results_rat) >= 1
    assert "Area 1" in results_rat[0]["section_title"]

    results_secret = pdf_service.search_document_sections("secret door", document_id=doc_id, campaign_id=cid)
    assert len(results_secret) >= 1
    assert "Area 2" in results_secret[0]["section_title"]
    assert "DC 15" in results_secret[0]["raw_text"]

def test_base_template_inheritance_and_stub_flag(setup_test_env):
    cid = setup_test_env

    # Seed an existing base creature in the campaign graph: "Veteran"
    graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="monster",
            title="Veteran",
            subtitle="Medium humanoid (any race), any alignment",
            summary="A hardened mercenary or royal guard.",
            content_markdown="### Actions\nMultiattack. Makes two longsword attacks and one shortsword attack.",
            data_json={
                "cr": "3",
                "hp": 58,
                "ac": 17,
                "speed": "30 ft.",
                "abilities": {"str": 16, "dex": 13, "con": 14, "int": 10, "wis": 11, "cha": 10}
            }
        ),
        default_campaign_id=cid
    )

    # 1. Test entity that references "Veteran" but has no stats -> should inherit base stats
    extracted = [
        {
            "type": "npc",
            "title": "Captain Kenneth (Veteran)",
            "subtitle": "Guard Captain",
            "summary": "Leader of the fortress garrison.",
            "content_markdown": "Kenneth leads the patrol on the ramparts.",
            "data_json": {"status": "planned"}
        },
        {
            "type": "monster",
            "title": "Shadow Wyrmling",
            "subtitle": "Unknown Draconic Beast",
            "summary": "A creature referenced in lore with unknown powers.",
            "content_markdown": "Legends speak of a shadowy wyrmling under the citadel.",
            "data_json": {"status": "planned"}
        }
    ]

    reconciled = ai_agent_service._reconcile_extracted_nodes_with_campaign(extracted, cid)
    assert len(reconciled) == 2

    # Captain Kenneth should have inherited the Veteran's stats
    kenneth = next(n for n in reconciled if "Kenneth" in n["title"])
    assert kenneth.get("base_template_title") == "Veteran"
    assert kenneth["data_json"].get("hp") == 58
    assert kenneth["data_json"].get("ac") == 17
    assert kenneth["data_json"]["abilities"]["str"] == 16
    assert kenneth.get("inherited_template") is True

    # Shadow Wyrmling does not have a base template -> should be flagged as needs_statblock
    wyrmling = next(n for n in reconciled if "Shadow Wyrmling" in n["title"])
    assert wyrmling.get("needs_statblock") is True
    assert wyrmling["data_json"].get("needs_statblock") is True
    assert "needs_statblock_prompt" in wyrmling

def test_dilemma_explanation_and_review_options(setup_test_env):
    cid = setup_test_env

    # Seed existing NPC: Meepo
    graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="npc",
            title="Meepo",
            subtitle="Kobold Dragon-Keeper",
            summary="Cowering kobold who lost the clan wyrmling.",
            data_json={"cr": "1/8", "hp": 7, "disposition": "friendly", "alignment": "lawful evil"}
        ),
        default_campaign_id=cid
    )

    # Extracted entity with conflict: Meepo with hostile disposition and different CR
    extracted = [
        {
            "type": "npc",
            "title": "Meepo",
            "subtitle": "Kobold Shaman",
            "summary": "Hostile dragon cultist.",
            "data_json": {"cr": "1/2", "hp": 14, "disposition": "hostile", "alignment": "chaotic evil"}
        }
    ]

    reconciled = ai_agent_service._reconcile_extracted_nodes_with_campaign(extracted, cid)
    assert len(reconciled) == 1
    node = reconciled[0]
    assert node["match_status"] == "conflict"
    assert "dilemma_explanation" in node
    assert "Contradiction Detected" in node["dilemma_explanation"]
    assert "review_options" in node
    assert "other" in node["review_options"]
