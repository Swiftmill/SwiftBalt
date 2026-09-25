from fastapi import APIRouter
from typing import List, Dict, Any
from app.providers.registry import registry

router = APIRouter(prefix="/api/providers", tags=["Providers"])


@router.get("", response_model=List[Dict[str, Any]])
async def get_providers_status():
    """
    Returns real operational status, domains, and capabilities for all supported providers.
    """
    return registry.get_all_providers_status()
