from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List
from app.models import (
    AgentChatRequest,
    BoxedTextRequest,
    CoachAdviceRequest,
    DocumentExtractRequest,
    EdgeCreate,
    NodeCreate,
    WeaveHookRequest,
)
from app.services import ai_agent_service, graph_service

router = APIRouter(prefix="/api/agent", tags=["agent"])

@router.post("/chat")
def chat(request: AgentChatRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    messages = [m.model_dump() for m in request.messages]
    return ai_agent_service.chat_with_agent(
        messages=messages,
        campaign_id=cid,
        context_node_id=request.context_node_id
    )

@router.post("/boxed-text")
def generate_boxed_text(request: BoxedTextRequest):
    return ai_agent_service.generate_boxed_text(
        location_title=request.location_title,
        mood=request.mood or "mysterious, ancient, dangerous",
        sensory_details=request.sensory_details or "damp stone, flickering torchlight",
        dm_notes=request.dm_notes or ""
    )

@router.post("/coach")
def get_coach_advice(request: CoachAdviceRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.get_coach_advice(
        situation=request.situation,
        challenge_type=request.challenge_type,
        campaign_id=cid
    )

@router.post("/weave-hook")
def weave_hook(request: WeaveHookRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.weave_quest_hook(
        pc_name=request.pc_name,
        pc_backstory=request.pc_backstory,
        target_node_id=request.target_node_id,
        campaign_id=cid
    )

@router.post("/extract-entities")
def extract_entities(request: DocumentExtractRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.extract_entities_from_text(
        text_content=request.text_content,
        campaign_id=cid,
        target_arc_id=request.target_arc_id
    )

from app.models import DecomposeAdventureRequest
from app.services import pdf_service
from pathlib import Path

UPLOAD_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "uploads"

@router.post("/decompose")
def decompose_adventure(request: DecomposeAdventureRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    text_to_analyze = request.text_content or ""

    if request.filename and not text_to_analyze:
        file_path = UPLOAD_DIR / request.filename
        if file_path.exists():
            if file_path.suffix.lower() == ".pdf":
                start_p = request.start_page or 1
                end_p = request.end_page or 30
                text_to_analyze = pdf_service.get_pdf_page_text(str(file_path), start_p, end_p)
            else:
                try:
                    with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                        text_to_analyze = f.read()[:20000]
                except Exception:
                    pass

    if not text_to_analyze:
        raise HTTPException(status_code=400, detail="No text content or uploaded file found to analyze.")

    history_dicts = [m.model_dump() for m in request.conversation_history] if request.conversation_history else None

    return ai_agent_service.decompose_adventure_document(
        text_content=text_to_analyze,
        instruction=request.instruction or "",
        decomposition_mode=request.decomposition_mode or "campaign_structure",
        campaign_id=cid,
        current_nodes=request.current_nodes,
        current_edges=request.current_edges,
        conversation_history=history_dicts
    )

@router.post("/apply-extracted")
def apply_extracted(data: Dict[str, Any]):
    """
    Commit extracted nodes and edges into the campaign graph.
    """
    cid = data.get("campaign_id") or graph_service.get_setting("active_campaign_id", "default-campaign")
    created_nodes = []
    title_to_id = {}

    for n in data.get("nodes", []):
        node = graph_service.create_node(
            NodeCreate(
                campaign_id=cid,
                type=n.get("type", "quest"),
                title=n.get("title", "Extracted Node"),
                subtitle=n.get("subtitle", ""),
                summary=n.get("summary", ""),
                content_markdown=n.get("content_markdown", ""),
                data_json=n.get("data_json", {}),
                revealed_to_players=n.get("revealed_to_players", False)
            ),
            default_campaign_id=cid
        )
        created_nodes.append(node)
        title_to_id[node.title] = node.id

    created_edges = []
    for e in data.get("edges", []):
        src_id = title_to_id.get(e.get("source_title")) or e.get("source_id")
        tgt_id = title_to_id.get(e.get("target_title")) or e.get("target_id")
        if src_id and tgt_id:
            edge = graph_service.create_edge(
                EdgeCreate(
                    campaign_id=cid,
                    source_id=src_id,
                    target_id=tgt_id,
                    relation_type=e.get("relation_type", "located_at"),
                    label=e.get("label", ""),
                    metadata_json=e.get("metadata_json", {})
                ),
                default_campaign_id=cid
            )
            created_edges.append(edge)

    return {
        "status": "applied",
        "nodes_created": len(created_nodes),
        "edges_created": len(created_edges)
    }

from app.models import ApplySessionAdaptationRequest, SessionAdaptRequest

@router.post("/adapt-session")
def adapt_session(request: SessionAdaptRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    if not request.transcript_text or not request.transcript_text.strip():
        raise HTTPException(status_code=400, detail="Transcript text is required to analyze session fallout.")

    history_dicts = [m.model_dump() for m in request.conversation_history] if request.conversation_history else None

    return ai_agent_service.adapt_campaign_from_transcript(
        transcript_text=request.transcript_text,
        campaign_id=cid,
        session_node_id=request.session_node_id,
        instruction=request.instruction or "",
        generate_player_recap=request.generate_player_recap if request.generate_player_recap is not None else True,
        current_adaptation=request.current_adaptation,
        conversation_history=history_dicts
    )

@router.post("/apply-session-adaptation")
def apply_session_adaptation(request: ApplySessionAdaptationRequest):
    cid = request.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return ai_agent_service.apply_session_adaptation(
        campaign_id=cid,
        status_updates=request.status_updates or [],
        node_updates=request.node_updates or [],
        new_nodes=request.new_nodes or [],
        new_edges=request.new_edges or [],
        next_session_node=request.next_session_node,
        parent_quest_id=request.parent_quest_id,
        player_note=request.player_note
    )

