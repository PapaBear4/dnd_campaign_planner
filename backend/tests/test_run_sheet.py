import json
import pytest
from fastapi.testclient import TestClient
from unittest.mock import patch

from app.main import app
from app.models import NodeCreate, EdgeCreate, CampaignCreate
from app.services import graph_service
from app.services.ai_agent_service import generate_session_run_sheet, _dispatch_tool_call

@pytest.fixture
def client():
    return TestClient(app)

def test_generate_session_run_sheet_service_and_recap():
    camp = graph_service.create_campaign(CampaignCreate(name="Runsheet Realm", setting="D&D 5e"))
    cid = camp.id

    # Create Session 1
    s1 = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="session",
            title="Session 1: The Tavern Gathering",
            summary="Party meets at the Green Dragon Inn and accepts a bounty.",
            sort_order=10,
        ),
        default_campaign_id=cid
    )

    # Create Session 2
    s2 = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="session",
            title="Session 2: Into the Crypts",
            summary="Party descends into the ancient crypt beneath the hill.",
            sort_order=20,
        ),
        default_campaign_id=cid
    )

    # Create Precedes edge: s1 -> s2
    graph_service.create_edge(
        EdgeCreate(
            campaign_id=cid,
            source_id=s1.id,
            target_id=s2.id,
            relation_type="precedes"
        ),
        default_campaign_id=cid
    )

    # Create Encounter contained in Session 2
    enc = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="encounter",
            title="Skeleton Ambush",
            summary="Four skeletons rise from sarcophagi.",
            data_json={"encounter_type": "Combat", "difficulty": "Medium", "combatants": "4x Skeletons"}
        ),
        default_campaign_id=cid
    )

    graph_service.create_edge(
        EdgeCreate(
            campaign_id=cid,
            source_id=s2.id,
            target_id=enc.id,
            relation_type="contains"
        ),
        default_campaign_id=cid
    )

    # Test Session 1 (no prior session -> prologue)
    with patch("app.services.ai_agent_service._get_configured_gemini_client", return_value=(None, "offline")):
        res1 = generate_session_run_sheet(session_id=s1.id, campaign_id=cid, save_to_node=True)
        assert res1["success"] is True
        assert res1["previous_session_title"] == "Campaign Kickoff / Prologue"
        assert "# 📜 Run-Sheet:" in res1["run_sheet_markdown"]

        # Verify saved to node
        updated_s1 = graph_service.get_node(s1.id)
        assert "# 📜 Run-Sheet:" in updated_s1.content_markdown
        assert "run_sheet" in updated_s1.data_json

        # Test Session 2 (detects Session 1 as previous session)
        res2 = generate_session_run_sheet(session_id=s2.id, campaign_id=cid, save_to_node=False)
        assert res2["success"] is True
        assert res2["previous_session_title"] == "Session 1: The Tavern Gathering"
        assert res2["beat_count"] >= 1
        assert "Skeleton Ambush" in res2["run_sheet_markdown"]

def test_generate_session_run_sheet_endpoint(client):
    camp = graph_service.create_campaign(CampaignCreate(name="Crypt Campaign", setting="D&D 5e"))
    cid = camp.id

    s = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="session",
            title="Session 3: The Crypt Sanctum",
            summary="Defeating the necromancer apprentice.",
            sort_order=30,
        ),
        default_campaign_id=cid
    )

    with patch("app.services.ai_agent_service._get_configured_gemini_client", return_value=(None, "offline")):
        resp = client.post(
            f"/api/agent/session/{s.id}/generate-run-sheet",
            json={"campaign_id": cid, "custom_instruction": "Highlight holy water tactic.", "save_to_node": True}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["session_id"] == s.id
        assert "# 📜 Run-Sheet: Session 3: The Crypt Sanctum" in data["run_sheet_markdown"]

def test_dispatch_tool_call_run_sheet():
    camp = graph_service.create_campaign(CampaignCreate(name="Keep Campaign", setting="D&D 5e"))
    cid = camp.id

    s = graph_service.create_node(
        NodeCreate(
            campaign_id=cid,
            type="session",
            title="Session 4: Return to the Keep",
            summary="Reporting back to Lord Neverember.",
            sort_order=40,
        ),
        default_campaign_id=cid
    )

    with patch("app.services.ai_agent_service._get_configured_gemini_client", return_value=(None, "offline")):
        res = _dispatch_tool_call(
            tool_name="generate_session_run_sheet",
            args={"session_id": s.id, "custom_instruction": "Celebrate victory.", "save_to_node": False},
            campaign_id=cid
        )
        assert res["success"] is True
        assert res["session_id"] == s.id
