# Frame Recommender — Architecture

ML-powered product recommendation engine for custom picture frames.
Learns from thousands of historical Adobe Commerce orders to suggest
frame configurations matching customer context.

## Problem

Customers configure highly custom frames (moulding profile, mat board
colors/widths, glass type, backing, opening size, orientation, style,
material). Given a new customer's context, recommend configurations
similar to what past customers with similar needs chose.

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Data ingestion | Python + `requests` | Adobe Commerce REST API client |
| Feature engineering | pandas + scikit-learn | Encode mixed categorical/numerical frame attributes |
| Recommendation model | scikit-learn (NearestNeighbors) + embeddings | Content-based filtering on frame feature vectors |
| API server | FastAPI | Lightweight, async, auto-docs |
| Storage | SQLite (dev) / PostgreSQL (prod) | Processed order cache + model metadata |
| Model artifacts | joblib | Serialize trained models to disk |

## Data Flow

```
Adobe Commerce REST API
        │
        ▼
  [1] Data Ingestion (pull orders, extract frame configs)
        │
        ▼
  [2] Feature Engineering (encode attributes → vectors)
        │
        ▼
  [3] Model Training (fit NearestNeighbors + cluster popular configs)
        │
        ▼
  [4] API Server (accept context → return recommendations)
```

## Frame Configuration Schema

Based on typical custom framing attributes from Adobe Commerce:

```python
FrameConfig:
  # Dimensions
  opening_width: float        # inches
  opening_height: float       # inches
  orientation: str            # "landscape" | "portrait" | "square"

  # Moulding
  moulding_material: str      # "wood" | "metal" | "composite" | "poly"
  moulding_width: float       # inches (profile width)
  moulding_color: str         # "black" | "white" | "natural" | "gold" | etc.
  moulding_style: str         # "modern" | "ornate" | "rustic" | "minimal" | etc.
  moulding_finish: str        # "matte" | "glossy" | "satin" | "distressed"

  # Mat board
  mat_included: bool
  mat_color_top: str          # primary mat color
  mat_color_bottom: str       # accent/reveal mat color (if double mat)
  mat_width_top: float        # inches
  mat_width_bottom: float     # inches (0 if single mat)

  # Glass
  glass_type: str             # "regular" | "non_glare" | "uv_protection" | "museum"

  # Backing & mounting
  backing_type: str           # "standard" | "acid_free" | "foam_core"
  mounting_type: str          # "dry_mount" | "hinge_mount" | "float_mount" | "none"

  # Metadata
  price: float
  category: str               # "photo" | "art" | "diploma" | "memorabilia" | "mirror"
```

## Recommendation Approach

### Content-Based Filtering with Nearest Neighbors

1. **Encode frame configs** into feature vectors:
   - Numerical features (dimensions, widths, price): StandardScaler
   - Categorical features (material, style, color): OneHotEncoder or OrdinalEncoder
   - Combined into a single feature matrix

2. **Fit a NearestNeighbors model** (ball tree, cosine similarity)
   on the full order history

3. **At recommendation time**:
   - Customer provides partial context (e.g., "16x20 photo, modern style, $50-100 budget")
   - Encode the partial input into same feature space (impute missing with mode/median)
   - Find K nearest historical orders
   - Return top N distinct configurations, ranked by frequency × similarity

### Popularity-Weighted Clustering (bonus layer)

- KMeans cluster the order history into ~20-50 "frame archetypes"
- Each cluster represents a popular configuration pattern
- Recommendations pull from the nearest cluster(s) weighted by cluster size

## API Endpoints

```
POST /recommend
  Body: { opening_width, opening_height, category, style_preference?, budget_range? }
  Returns: [ { config: FrameConfig, score: float, similar_orders: int } ]

GET /popular
  Query: ?category=photo&limit=10
  Returns: top N most-ordered configurations by category

GET /health
  Returns: { status: "ok", model_version, order_count }

POST /ingest
  Triggers a fresh data pull from Adobe Commerce API
  Returns: { orders_fetched, configs_extracted }

POST /train
  Retrains the model on current data
  Returns: { model_version, training_samples, clusters }
```

## Project Structure

```
frame-recommender/
├── pyproject.toml            # Dependencies & project config
├── .env.example              # Environment variable template
├── src/
│   ├── __init__.py
│   ├── api.py                # FastAPI application
│   ├── config.py             # Settings & env vars
│   ├── ingest/
│   │   ├── __init__.py
│   │   ├── adobe_commerce.py # REST API client
│   │   └── schema.py         # FrameConfig dataclass & validation
│   ├── features/
│   │   ├── __init__.py
│   │   └── encoder.py        # Feature engineering pipeline
│   ├── model/
│   │   ├── __init__.py
│   │   ├── recommender.py    # NearestNeighbors recommender
│   │   └── clusters.py       # Popularity clustering
│   └── db.py                 # SQLite/Postgres storage layer
├── models/                   # Trained model artifacts (.joblib)
├── data/                     # Cached order data
├── scripts/
│   ├── ingest.py             # CLI: pull orders from Adobe Commerce
│   └── train.py              # CLI: train/retrain model
└── tests/
    ├── test_encoder.py
    └── test_recommender.py
```

## Environment Variables

```
ADOBE_COMMERCE_BASE_URL=https://your-store.com/rest/V1
ADOBE_COMMERCE_TOKEN=your-integration-token
DATABASE_URL=sqlite:///data/frames.db  # or postgres://...
MODEL_DIR=./models
```
