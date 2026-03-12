"""FastAPI application for serving frame recommendations."""

import logging
import os

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from src.config import settings
from src.ingest.adobe_commerce import fetch_all_frame_configs
from src.ingest.schema import FrameConfig
from src.model.recommender import FrameRecommender
from src.model.clusters import FrameClusterer

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Quotable Frame Recommender",
    description="ML-powered frame configuration recommendations based on historical order data",
    version="0.1.0",
)

# Global model instance — loaded on startup or first request
_recommender: FrameRecommender | None = None
_clusterer: FrameClusterer | None = None


def get_recommender() -> FrameRecommender:
    global _recommender
    if _recommender is None:
        model_path = os.path.join(settings.model_dir, "recommender_latest.joblib")
        if os.path.exists(model_path):
            _recommender = FrameRecommender.load(model_path)
        else:
            raise HTTPException(
                status_code=503,
                detail="Model not trained yet. Run POST /train first.",
            )
    return _recommender


# ── Request/Response Models ──────────────────────────────────────


class RecommendRequest(BaseModel):
    """Input for recommendation: customer's desired frame context."""
    opening_width: float = 0.0
    opening_height: float = 0.0
    category: str = "photo"
    moulding_style: str | None = None
    moulding_material: str | None = None
    moulding_color: str | None = None
    glass_type: str | None = None
    mat_included: bool | None = None
    budget_min: float | None = None
    budget_max: float | None = None
    n_results: int = 5


class RecommendResponse(BaseModel):
    recommendations: list[dict]
    query_used: dict
    model_version: str


class IngestResponse(BaseModel):
    orders_fetched: int
    configs_extracted: int


class TrainResponse(BaseModel):
    model_version: str
    training_samples: int
    feature_dimension: int
    n_neighbors: int
    clusters: dict | None = None


class HealthResponse(BaseModel):
    status: str
    model_version: str | None
    order_count: int


# ── Endpoints ────────────────────────────────────────────────────


@app.get("/health", response_model=HealthResponse)
async def health():
    """Check API health and model status."""
    try:
        rec = get_recommender()
        return HealthResponse(
            status="ok",
            model_version=rec.model_version,
            order_count=len(rec.configs),
        )
    except HTTPException:
        return HealthResponse(
            status="no_model",
            model_version=None,
            order_count=0,
        )


@app.post("/recommend", response_model=RecommendResponse)
async def recommend(request: RecommendRequest):
    """
    Get frame recommendations based on customer context.

    Provide whatever attributes you know (dimensions, style, category, budget)
    and the model will find the most similar historical configurations.
    """
    rec = get_recommender()

    # Build a query FrameConfig from the request
    query = FrameConfig(
        opening_width=request.opening_width,
        opening_height=request.opening_height,
        category=request.category,
    )

    # Apply optional filters
    if request.moulding_style:
        query.moulding_style = request.moulding_style
    if request.moulding_material:
        query.moulding_material = request.moulding_material
    if request.moulding_color:
        query.moulding_color = request.moulding_color
    if request.glass_type:
        query.glass_type = request.glass_type
    if request.mat_included is not None:
        query.mat_included = request.mat_included

    # Derive orientation
    if query.opening_width > 0 and query.opening_height > 0:
        if abs(query.opening_width - query.opening_height) < 0.5:
            query.orientation = "square"
        elif query.opening_width > query.opening_height:
            query.orientation = "landscape"
        else:
            query.orientation = "portrait"

    budget_range = None
    if request.budget_min is not None or request.budget_max is not None:
        budget_range = (
            request.budget_min or 0.0,
            request.budget_max or 999999.0,
        )

    results = rec.recommend(
        query=query,
        n_results=request.n_results,
        budget_range=budget_range,
    )

    return RecommendResponse(
        recommendations=results,
        query_used=query.to_dict(),
        model_version=rec.model_version,
    )


@app.get("/popular")
async def popular(category: str | None = None, limit: int = 10):
    """Get the most popular frame configurations, optionally filtered by category."""
    rec = get_recommender()
    return rec.get_popular(category=category, limit=limit)


@app.post("/ingest", response_model=IngestResponse)
async def ingest():
    """
    Pull fresh order data from Adobe Commerce API.
    Saves extracted frame configs to the data directory.
    """
    import json
    from pathlib import Path

    configs = fetch_all_frame_configs()

    # Save to data directory
    data_dir = Path("data")
    data_dir.mkdir(exist_ok=True)

    data_path = data_dir / "frame_configs.json"
    with open(data_path, "w") as f:
        json.dump([c.to_dict() for c in configs], f, indent=2)

    return IngestResponse(
        orders_fetched=len(set(c.order_id for c in configs)),
        configs_extracted=len(configs),
    )


@app.post("/train", response_model=TrainResponse)
async def train():
    """
    Train (or retrain) the recommendation model on current data.
    Loads frame configs from the data directory and fits the model.
    """
    global _recommender, _clusterer
    import json
    from pathlib import Path

    data_path = Path("data") / "frame_configs.json"
    if not data_path.exists():
        raise HTTPException(
            status_code=400,
            detail="No data found. Run POST /ingest first.",
        )

    with open(data_path) as f:
        raw_configs = json.load(f)

    configs = [FrameConfig.from_dict(c) for c in raw_configs]
    if len(configs) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 configs to train, got {len(configs)}.",
        )

    # Train recommender
    recommender = FrameRecommender()
    train_meta = recommender.train(configs)
    recommender.save()
    _recommender = recommender

    # Train clusterer
    cluster_meta = None
    if len(configs) >= 4:
        clusterer = FrameClusterer()
        cluster_meta = clusterer.fit(configs, recommender.encoder)
        _clusterer = clusterer

    return TrainResponse(
        model_version=train_meta["model_version"],
        training_samples=train_meta["training_samples"],
        feature_dimension=train_meta["feature_dimension"],
        n_neighbors=train_meta["n_neighbors"],
        clusters=cluster_meta,
    )


@app.get("/archetypes")
async def archetypes(top_n: int = 10):
    """Get the top frame archetypes (popular configuration clusters)."""
    if _clusterer is None:
        raise HTTPException(
            status_code=503,
            detail="Clusterer not trained. Run POST /train first.",
        )
    return _clusterer.get_archetypes(top_n=top_n)
