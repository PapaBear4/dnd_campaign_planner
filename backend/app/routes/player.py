from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models import (
    GraphResponse,
    HierarchyItem,
    PlayerNoteCreate,
    PlayerNoteResponse,
    PlayerNoteUpdate,
)
from app.services import graph_service

router = APIRouter(prefix="/api/player", tags=["player"])

@router.get("/graph", response_model=GraphResponse)
def get_player_graph(campaign_id: Optional[str] = Query(None)):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.get_graph(cid, player_mode=True)

@router.get("/hierarchy", response_model=List[HierarchyItem])
def get_player_hierarchy(campaign_id: Optional[str] = Query(None)):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.get_hierarchy_tree(cid, player_mode=True)

@router.get("/notes", response_model=List[PlayerNoteResponse])
def list_player_notes(
    campaign_id: Optional[str] = Query(None),
    node_id: Optional[str] = Query(None)
):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.list_player_notes(cid, node_id=node_id)

@router.post("/notes", response_model=PlayerNoteResponse)
def create_player_note(data: PlayerNoteCreate):
    cid = data.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.create_player_note(data, default_campaign_id=cid)

@router.put("/notes/{note_id}", response_model=PlayerNoteResponse)
def update_player_note(note_id: str, data: PlayerNoteUpdate):
    note = graph_service.update_player_note(note_id, data)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    return note

@router.delete("/notes/{note_id}")
def delete_player_note(note_id: str):
    success = graph_service.delete_player_note(note_id)
    if not success:
        raise HTTPException(status_code=404, detail="Note not found")
    return {"status": "deleted", "id": note_id}
