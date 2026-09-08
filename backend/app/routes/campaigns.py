from fastapi import APIRouter, HTTPException
from typing import Any, Dict, List
from app.models import CampaignCreate, CampaignResponse, CampaignUpdate
from app.services import graph_service

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])

@router.get("", response_model=List[CampaignResponse])
def list_campaigns():
    return graph_service.list_campaigns()

@router.post("", response_model=CampaignResponse)
def create_campaign(data: CampaignCreate):
    return graph_service.create_campaign(data)

@router.get("/{campaign_id}", response_model=CampaignResponse)
def get_campaign(campaign_id: str):
    campaign = graph_service.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

@router.put("/{campaign_id}", response_model=CampaignResponse)
def update_campaign(campaign_id: str, data: CampaignUpdate):
    campaign = graph_service.update_campaign(campaign_id, data)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return campaign

@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: str):
    success = graph_service.delete_campaign(campaign_id)
    if not success:
        raise HTTPException(status_code=404, detail="Campaign not found")
    return {"status": "deleted", "id": campaign_id}

@router.get("/{campaign_id}/export")
def export_campaign(campaign_id: str) -> Dict[str, Any]:
    campaign = graph_service.get_campaign(campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    
    nodes = graph_service.list_nodes(campaign_id)
    edges = graph_service.list_edges(campaign_id)
    player_notes = graph_service.list_player_notes(campaign_id)

    return {
        "campaign": campaign.model_dump(),
        "nodes": [n.model_dump() for n in nodes],
        "edges": [e.model_dump() for e in edges],
        "player_notes": [p.model_dump() for p in player_notes]
    }

@router.post("/import")
def import_campaign(data: Dict[str, Any]):
    campaign_data = data.get("campaign", {})
    new_campaign = graph_service.create_campaign(
        CampaignCreate(
            name=campaign_data.get("name", "Imported Campaign"),
            description=campaign_data.get("description", ""),
            setting=campaign_data.get("setting", "D&D 5e")
        )
    )
    
    # Map old node IDs to new node IDs
    id_map = {}
    from app.models import NodeCreate, EdgeCreate
    for n in data.get("nodes", []):
        old_id = n.get("id")
        created = graph_service.create_node(
            NodeCreate(
                campaign_id=new_campaign.id,
                type=n.get("type", "quest"),
                title=n.get("title", "Untitled"),
                subtitle=n.get("subtitle", ""),
                summary=n.get("summary", ""),
                content_markdown=n.get("content_markdown", ""),
                data_json=n.get("data_json", {}),
                revealed_to_players=n.get("revealed_to_players", False),
                tags=n.get("tags", []),
                sort_order=n.get("sort_order", 0),
            ),
            default_campaign_id=new_campaign.id
        )
        if old_id:
            id_map[old_id] = created.id

    for e in data.get("edges", []):
        old_src = e.get("source_id")
        old_tgt = e.get("target_id")
        new_src = id_map.get(old_src, old_src)
        new_tgt = id_map.get(old_tgt, old_tgt)
        if new_src and new_tgt:
            graph_service.create_edge(
                EdgeCreate(
                    campaign_id=new_campaign.id,
                    source_id=new_src,
                    target_id=new_tgt,
                    relation_type=e.get("relation_type", "contains"),
                    label=e.get("label", ""),
                    metadata_json=e.get("metadata_json", {}),
                    revealed_to_players=e.get("revealed_to_players", False),
                ),
                default_campaign_id=new_campaign.id
            )

    return {"status": "imported", "campaign_id": new_campaign.id, "name": new_campaign.name}


@router.get("/{campaign_id}/duplicates")
def get_campaign_duplicates(campaign_id: str) -> Dict[str, Any]:
    clusters = graph_service.find_duplicate_nodes(campaign_id)
    return {
        "campaign_id": campaign_id,
        "duplicate_clusters_count": len(clusters),
        "clusters": clusters,
    }


@router.post("/{campaign_id}/deduplicate")
def deduplicate_campaign_endpoint(campaign_id: str) -> Dict[str, Any]:
    result = graph_service.deduplicate_campaign(campaign_id)
    return result
