"""
BioTrajectory Curated Disease Library API
Provides evidence-based medical disease data, categorization, and search capabilities.
"""

import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query, status

logger = logging.getLogger("biotrajectory.diseases")

router = APIRouter(prefix="/api/diseases", tags=["Disease Library"])

# Path to the curated diseases dataset
DATA_FILE = Path(__file__).resolve().parent.parent / "data" / "diseases.json"

_cached_data: Optional[Dict[str, Any]] = None


def load_diseases_data() -> Dict[str, Any]:
    """Load and cache the curated disease knowledgebase."""
    global _cached_data
    if _cached_data is not None:
        return _cached_data

    if not DATA_FILE.exists():
        logger.warning("Diseases data file not found at %s", DATA_FILE)
        return {
            "primaryCategories": ["All Conditions"],
            "subCategories": ["All"],
            "diseases": []
        }

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            _cached_data = json.load(f)
            return _cached_data
    except Exception as e:
        logger.error("Failed to parse diseases data file: %s", e)
        return {
            "primaryCategories": ["All Conditions"],
            "subCategories": ["All"],
            "diseases": []
        }


@router.get("", response_model=Dict[str, Any])
async def get_diseases(
    category: Optional[str] = Query(None, description="Primary category group filter"),
    sub_category: Optional[str] = Query(None, description="Subcategory filter"),
    search: Optional[str] = Query(None, description="Search term across name, symptoms, or medical name"),
):
    """
    Retrieve curated medical diseases with optional category, subcategory, and keyword filtering.
    """
    data = load_diseases_data()
    all_diseases = data.get("diseases", [])
    primary_categories = data.get("primaryCategories", [])
    sub_categories = data.get("subCategories", [])

    filtered = all_diseases

    if category and category.lower() != "all conditions":
        filtered = [
            d for d in filtered
            if d.get("categoryGroup", "").lower() == category.lower()
        ]

    if sub_category and sub_category.lower() != "all":
        filtered = [
            d for d in filtered
            if d.get("subCategory", "").lower() == sub_category.lower()
        ]

    if search:
        q = search.lower().strip()
        filtered = [
            d for d in filtered
            if (
                q in d.get("name", "").lower()
                or q in d.get("medicalName", "").lower()
                or q in d.get("shortDescription", "").lower()
                or any(q in s.lower() for s in d.get("signsYouMayNotice", []))
                or any(q in c.lower() for c in d.get("whyDoesItHappen", []))
            )
        ]

    return {
        "total": len(all_diseases),
        "filtered_count": len(filtered),
        "primary_categories": primary_categories,
        "sub_categories": sub_categories,
        "diseases": filtered,
    }


@router.get("/categories", response_model=Dict[str, Any])
async def get_categories():
    """Get all available primary and subcategories for the disease library."""
    data = load_diseases_data()
    return {
        "primary_categories": data.get("primaryCategories", []),
        "sub_categories": data.get("subCategories", []),
        "total_conditions": len(data.get("diseases", [])),
    }


@router.get("/{disease_id}", response_model=Dict[str, Any])
async def get_disease_by_id(disease_id: str):
    """Retrieve full clinical details for a specific disease by ID."""
    data = load_diseases_data()
    all_diseases = data.get("diseases", [])

    matched = next((d for d in all_diseases if d.get("id") == disease_id), None)
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Disease condition with ID '{disease_id}' not found.",
        )

    return matched
