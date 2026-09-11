import pytest
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.services import ai_agent_service

@pytest.fixture
def client():
    return TestClient(app)

def test_decomposition_job_crud(client):
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "campaign_id": "default-campaign",
        "status": "mining",
        "current_step": 2,
        "clusters": [
            {
                "id": "cluster-1",
                "label": "Pages 1–4",
                "start_page": 1,
                "end_page": 4,
                "subagent_name": "Worker Alpha",
                "status": "completed",
                "error": None
            }
        ],
        "scratchpads": {
            "Worker Alpha": {
                "subagent_name": "Worker Alpha",
                "cluster_label": "Pages 1–4",
                "rooms_inventoried": ["Area 1: Sunken Courtyard", "Area 2: Entry Hall"],
                "npcs_identified": ["Meepo"],
                "monsters_spotted": ["Dire Rat (3x)"],
                "sidebars_captured": ["Dragon Cult Lore"],
                "traps_secrets": ["Pressure Plate Pit Trap"],
                "notes": "Worker Alpha finished slice 1."
            }
        },
        "draft_nodes": [
            {"type": "location", "title": "Area 1: Sunken Courtyard", "summary": "Ruined courtyard"},
            {"type": "npc", "title": "Meepo", "summary": "Kobold dragon keeper"}
        ],
        "draft_edges": [],
        "qa_results": {},
        "overview_summary": "Draft in progress",
        "model_name": "gemini-flash-latest",
        "error_message": None
    }

    ai_agent_service.save_decomposition_job(job)

    # Verify retrieval via service
    loaded = ai_agent_service.get_decomposition_job(job_id)
    assert loaded is not None
    assert loaded["id"] == job_id
    assert len(loaded["clusters"]) == 1
    assert "Worker Alpha" in loaded["scratchpads"]
    assert "Area 1: Sunken Courtyard" in loaded["scratchpads"]["Worker Alpha"]["rooms_inventoried"]

    # Verify retrieval via route
    resp = client.get(f"/api/agent/decompose/job/{job_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == job_id
    assert len(data["subagents"]) >= 3  # Worker Alpha + QA Auditor + Domain Specialist


def test_decomposition_job_retry_step_4(client):
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "campaign_id": "default-campaign",
        "status": "failed",
        "current_step": 4,
        "clusters": [
            {
                "id": "cluster-1",
                "label": "Pages 1–4",
                "start_page": 1,
                "end_page": 4,
                "subagent_name": "Worker Alpha",
                "status": "completed",
                "error": None
            }
        ],
        "scratchpads": {
            "Worker Alpha": {
                "subagent_name": "Worker Alpha",
                "cluster_label": "Pages 1–4",
                "rooms_inventoried": ["Area 1: Sunken Courtyard"],
                "npcs_identified": ["Meepo"],
                "monsters_spotted": ["Dire Rat"],
                "sidebars_captured": [],
                "traps_secrets": [],
                "notes": "Completed slice 1."
            }
        },
        "draft_nodes": [
            {"type": "location", "title": "Area 1: Sunken Courtyard", "summary": "Ruined courtyard"},
            {"type": "npc", "title": "Meepo", "summary": "Kobold keeper"}
        ],
        "draft_edges": [],
        "error_message": "Simulated deconfliction timeout"
    }

    ai_agent_service.save_decomposition_job(job)

    # Trigger retry via route
    retry_resp = client.post(f"/api/agent/decompose/job/{job_id}/retry?step=4")
    assert retry_resp.status_code == 200
    result = retry_resp.json()
    assert result["status"] == "completed"
    assert result["current_step"] == 4
    assert result["error"] is None
    assert len(result["extracted_nodes"]) == 2
    assert "Worker Alpha" in result["scratchpads"]


def test_decomposition_job_emergency_stop(client):
    job_id = str(uuid.uuid4())
    job = {
        "id": job_id,
        "campaign_id": "default-campaign",
        "status": "mining",
        "current_step": 2,
        "clusters": [{"id": "c1", "start_page": 1, "end_page": 2, "status": "running"}],
        "scratchpads": {},
        "draft_nodes": [{"type": "location", "title": "Room 1", "summary": "A room"}],
        "draft_edges": []
    }
    ai_agent_service.save_decomposition_job(job)

    # Post emergency stop
    stop_resp = client.post(f"/api/agent/decompose/job/{job_id}/stop")
    assert stop_resp.status_code == 200
    data = stop_resp.json()
    assert data["status"] == "stopped"
    assert len(data["extracted_nodes"]) == 1

    # Verify saved state
    loaded = ai_agent_service.get_decomposition_job(job_id)
    assert loaded["status"] == "stopped"
    assert "interrupted" in loaded["error_message"].lower()


def test_decomposition_steering_incorporates_directives(client, monkeypatch):
    """
    Test that calling decompose with current_nodes and custom directives
    bakes the directives into the working draft nodes in place without re-running chunking.
    """
    monkeypatch.setattr(ai_agent_service, "_get_configured_gemini_client", lambda: (None, "offline-decomposer"))
    current_nodes = [
        {
            "type": "npc",
            "title": "Meepo",
            "summary": "Kobold keeper",
            "content_markdown": "Meepo is a weeping kobold.",
            "custom_directive": "Make him an ally and give him the dragon cage key",
            "action": "other"
        },
        {
            "type": "location",
            "title": "Area 1: Sunken Courtyard",
            "summary": "Ruined courtyard",
            "content_markdown": "Ancient stone floor covered in debris.",
        }
    ]

    resp = client.post(
        "/api/agent/decompose",
        json={
            "instruction": "Incorporate all custom directives into the working draft.",
            "current_nodes": current_nodes,
            "campaign_id": "default-campaign",
            "exhaustive": False
        }
    )
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["extracted_nodes"]) == 2
    meepo = next(n for n in data["extracted_nodes"] if n["title"] == "Meepo")
    assert "DM Directive Applied" in meepo["content_markdown"] or "dragon cage key" in meepo["content_markdown"]
    assert meepo.get("custom_directive") is None
    assert meepo.get("action") in ("create", "merge")

