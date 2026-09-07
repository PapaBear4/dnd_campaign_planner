from fastapi import APIRouter
from app.models import SettingsResponse, SettingsUpdate
from app.services import graph_service

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("", response_model=SettingsResponse)
def get_settings():
    api_key = graph_service.get_setting("gemini_api_key", "")
    model = graph_service.get_setting("gemini_model", "gemini-2.5-flash")
    active_cid = graph_service.get_setting("active_campaign_id", "default-campaign")

    return SettingsResponse(
        gemini_api_key_configured=bool(api_key.strip()),
        gemini_model=model,
        active_campaign_id=active_cid
    )

@router.put("", response_model=SettingsResponse)
def update_settings(data: SettingsUpdate):
    if data.gemini_api_key is not None:
        graph_service.set_setting("gemini_api_key", data.gemini_api_key.strip())
    if data.gemini_model is not None:
        graph_service.set_setting("gemini_model", data.gemini_model.strip())
    if data.active_campaign_id is not None:
        graph_service.set_setting("active_campaign_id", data.active_campaign_id.strip())

    return get_settings()

from typing import Optional
from app.models import ModelQueryRequest, ModelsListResponse
from app.services import ai_agent_service

@router.get("/models", response_model=ModelsListResponse)
def get_available_models(api_key: Optional[str] = None):
    return ai_agent_service.list_available_gemini_models(api_key=api_key)

@router.post("/models", response_model=ModelsListResponse)
def query_available_models(data: Optional[ModelQueryRequest] = None):
    key = data.api_key if data else None
    return ai_agent_service.list_available_gemini_models(api_key=key)

