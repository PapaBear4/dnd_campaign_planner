from fastapi import APIRouter, Query
from typing import List, Optional
from app.models import GraphResponse, HierarchyItem, NodeResponse
from app.services import graph_service

router = APIRouter(prefix="/api", tags=["graph"])

@router.get("/graph", response_model=GraphResponse)
def get_graph(
    campaign_id: Optional[str] = Query(None),
    player_mode: bool = Query(False)
):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.get_graph(cid, player_mode=player_mode)

@router.get("/hierarchy", response_model=List[HierarchyItem])
def get_hierarchy(
    campaign_id: Optional[str] = Query(None),
    player_mode: bool = Query(False)
):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.get_hierarchy_tree(cid, player_mode=player_mode)

@router.get("/search", response_model=List[NodeResponse])
def search_nodes(
    q: str = Query(..., min_length=1),
    campaign_id: Optional[str] = Query(None),
    player_mode: bool = Query(False)
):
    cid = campaign_id or graph_service.get_setting("active_campaign_id", "default-campaign")
    return graph_service.search_nodes(cid, query_str=q, player_mode=player_mode)
