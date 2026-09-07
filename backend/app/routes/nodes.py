from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from app.models import NodeCreate, NodeResponse, NodeUpdate
from app.services import graph_service

router = APIRouter(prefix="/api/nodes", tags=["nodes"])

@router.get("", response_model=List[NodeResponse])
def list_nodes(
    campaign_id: Optional[str] = Query(None),
    type: Optional[str] = Query(None),
    revealed_only: bool = Query(False),
    tag: Optional[str] = Query(None)
):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.list_nodes(cid, node_type=type, revealed_only=revealed_only, tag=tag)

@router.post("", response_model=NodeResponse)
def create_node(data: NodeCreate):
    cid = data.campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.create_node(data, default_campaign_id=cid)

@router.get("/{node_id}", response_model=NodeResponse)
def get_node(node_id: str):
    node = graph_service.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.put("/{node_id}", response_model=NodeResponse)
def update_node(node_id: str, data: NodeUpdate):
    node = graph_service.update_node(node_id, data)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    return node

@router.delete("/{node_id}")
def delete_node(node_id: str):
    success = graph_service.delete_node(node_id)
    if not success:
        raise HTTPException(status_code=404, detail="Node not found")
    return {"status": "deleted", "id": node_id}

@router.post("/{node_id}/toggle-reveal", response_model=NodeResponse)
def toggle_reveal(node_id: str):
    node = graph_service.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    new_state = not node.revealed_to_players
    updated = graph_service.update_node(node_id, NodeUpdate(revealed_to_players=new_state))
    return updated
