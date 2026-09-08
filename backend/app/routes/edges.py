from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models import EdgeCreate, EdgeResponse, EdgeUpdate
from app.services import graph_service

router = APIRouter(prefix="/api/edges", tags=["edges"])

@router.get("", response_model=List[EdgeResponse])
def list_edges(
    campaign_id: Optional[str] = Query(None),
    source_id: Optional[str] = Query(None),
    target_id: Optional[str] = Query(None),
    relation_type: Optional[str] = Query(None),
    revealed_only: bool = Query(False)
):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.list_edges(
        cid,
        source_id=source_id,
        target_id=target_id,
        relation_type=relation_type,
        revealed_only=revealed_only
    )

@router.post("", response_model=EdgeResponse)
def create_edge(data: EdgeCreate):
    cid = data.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.create_edge(data, default_campaign_id=cid)

@router.get("/{edge_id}", response_model=EdgeResponse)
def get_edge(edge_id: str):
    edge = graph_service.get_edge(edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge

@router.put("/{edge_id}", response_model=EdgeResponse)
def update_edge(edge_id: str, data: EdgeUpdate):
    edge = graph_service.update_edge(edge_id, data)
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    return edge

@router.delete("/{edge_id}")
def delete_edge(edge_id: str):
    success = graph_service.delete_edge(edge_id)
    if not success:
        raise HTTPException(status_code=404, detail="Edge not found")
    return {"status": "deleted", "id": edge_id}

@router.post("/{edge_id}/toggle-canon", response_model=EdgeResponse)
def toggle_edge_canon(edge_id: str, is_canon: Optional[bool] = None):
    edge = graph_service.get_edge(edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail="Edge not found")
    
    new_state = (not edge.is_canon) if is_canon is None else is_canon
    updated = graph_service.update_edge(edge_id, EdgeUpdate(is_canon=new_state))
    return updated

