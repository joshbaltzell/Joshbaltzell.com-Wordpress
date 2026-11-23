# Setup Instructions

Setup for the **Frame Recommender** (`frame-recommender/`), an ML recommendation engine for custom picture frame configurations.

---

## Frame Recommender

### Prerequisites
- Python 3.10+
- Access to your Adobe Commerce (Magento 2) REST API

### 1. Install Dependencies
```bash
cd frame-recommender
pip install -r requirements.txt
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env:
#   ADOBE_COMMERCE_BASE_URL — your store's REST API URL (e.g. https://store.com/rest/V1)
#   ADOBE_COMMERCE_TOKEN — integration access token from Admin > System > Integrations
```

### 3. Discover Your Option Map
Your Adobe Commerce store uses custom product options with numeric IDs. You need to map these to frame attributes.

```bash
python scripts/ingest.py --discover-options
```

This fetches 10 sample orders and prints all custom option IDs found. Then edit `src/ingest/adobe_commerce.py` and update the `OPTION_MAP` dictionary in `_map_options_to_config()`. Uncomment and set the option IDs to match your store:

```python
OPTION_MAP = {
    "142": ("opening_width", float),
    "143": ("opening_height", float),
    "144": ("moulding_material", str),
    # ... etc
}
```

### 4. Ingest Orders
```bash
python scripts/ingest.py
# Saves frame configs to data/frame_configs.json
```

### 5. Train the Model
```bash
python scripts/train.py
# Trains NearestNeighbors + KMeans, saves to models/
```

### 6. Run the API
```bash
uvicorn src.api:app --host 0.0.0.0 --port 8000
```

### 7. API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Check model status |
| POST | `/recommend` | Get frame recommendations |
| GET | `/popular` | Most popular configurations |
| GET | `/archetypes` | Frame archetype clusters |
| POST | `/ingest` | Pull fresh data from Adobe Commerce |
| POST | `/train` | Retrain the model |

**Example recommendation request:**
```json
POST /recommend
{
  "opening_width": 8.0,
  "opening_height": 10.0,
  "category": "photo",
  "moulding_style": "modern",
  "budget_min": 30,
  "budget_max": 100,
  "n_results": 5
}
```

### 8. Running Tests
```bash
python tests/test_recommender.py
```

---

## Architecture Notes

### Frame Recommender
- **scikit-learn NearestNeighbors** — cosine similarity on encoded frame vectors
- **ColumnTransformer pipeline** — StandardScaler (numerical) + OneHotEncoder (categorical)
- **KMeans clustering** — discovers frame "archetypes" from order patterns
- **FastAPI** — REST API for serving recommendations
- **Adobe Commerce REST API** — paginated order fetching with custom option extraction
