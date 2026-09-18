from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel
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

@router.post("/{node_id}/toggle-canon", response_model=NodeResponse)
def toggle_canon(node_id: str, is_canon: Optional[bool] = None):
    node = graph_service.get_node(node_id)
    if not node:
        raise HTTPException(status_code=404, detail="Node not found")
    
    new_state = (not node.is_canon) if is_canon is None else is_canon
    updated = graph_service.update_node(node_id, NodeUpdate(is_canon=new_state))
    return updated


class BulkStatusItem(BaseModel):
    node_id: str
    status: str


class BulkStatusRequest(BaseModel):
    updates: Optional[List[BulkStatusItem]] = None
    node_ids: Optional[List[str]] = None
    status: Optional[str] = None


@router.post("/bulk-status")
def bulk_update_status(req: BulkStatusRequest):
    updates: List[dict] = []
    if req.updates:
        updates = [{"node_id": u.node_id, "status": u.status} for u in req.updates]
    elif req.node_ids and req.status:
        updates = [{"node_id": nid, "status": req.status} for nid in req.node_ids]
    else:
        raise HTTPException(status_code=400, detail="Must provide updates list or node_ids with status")
    
    return graph_service.bulk_update_node_status(updates)


@router.post("/{node_id}/archive", response_model=NodeResponse)
def archive_node(node_id: str):
    res = graph_service.update_node_status(node_id, "archived")
    if not res:
        raise HTTPException(status_code=404, detail="Node not found")
    return res


@router.post("/{node_id}/restore", response_model=NodeResponse)
def restore_node(node_id: str, target_status: str = Query("active")):
    status = target_status if target_status in ("planned", "active", "in_progress") else "active"
    res = graph_service.update_node_status(node_id, status)
    if not res:
        raise HTTPException(status_code=404, detail="Node not found")
    return res

