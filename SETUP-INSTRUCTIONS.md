# Setup Instructions

This repo contains two independent tools:

1. **Quotable** (`slack-interview-bot/`) — AI-powered Slack interview bot that collects quotes for articles
2. **Frame Recommender** (`frame-recommender/`) — ML recommendation engine for custom picture frame configurations

---

## Quotable (Slack Interview Bot)

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Redis (for BullMQ job queue)
- A Slack workspace with admin access
- Google Gemini API key

### 1. Install Dependencies
```bash
cd slack-interview-bot
npm install
```

### 2. Create Your Database
```bash
createdb interview_bot
psql interview_bot < src/db/migrations/0001_initial.sql
psql interview_bot < src/db/migrations/0002_add_quotes_and_deadlines.sql
```

### 3. Set Up Slack App
1. Go to https://api.slack.com/apps and create a new app
2. Enable **Socket Mode** (for development) — generates an App-Level Token (`xapp-...`)
3. Under **OAuth & Permissions**, add these Bot Token Scopes:
   - `chat:write`
   - `im:history`
   - `im:read`
   - `im:write`
   - `users:read`
   - `commands`
   - `reactions:write`
4. Install the app to your workspace — copy the Bot Token (`xoxb-...`)
5. Under **Slash Commands**, create `/quotable`
6. Under **Event Subscriptions**, subscribe to `message.im`
7. Under **Interactivity**, enable it (for button clicks and modals)

### 4. Configure Environment
```bash
cp .env.example .env
# Edit .env with your actual values:
#   DATABASE_URL — your PostgreSQL connection string
#   REDIS_URL — your Redis connection string
#   SLACK_BOT_TOKEN — from step 3
#   SLACK_SIGNING_SECRET — from your Slack app's Basic Information page
#   SLACK_APP_TOKEN — from Socket Mode setup (dev only)
#   GEMINI_API_KEY — from Google AI Studio (https://aistudio.google.com/apikey)
#   APP_URL — where your Next.js app runs (http://localhost:3000 for dev)
```

### 5. Run in Development
```bash
# Terminal 1: Next.js app (dashboard + API)
npm run dev

# Terminal 2: Background workers (processes answers, sends questions, nudges)
npx tsx src/jobs/worker.ts
```

### 6. Using Quotable

**In the dashboard** (http://localhost:3000):
1. Click "New Project" — fill in title, thesis, audience, deadline
2. Add participants (you need their Slack user IDs)
3. Click "Start Interviews" — the bot messages each participant

**In Slack**:
- `/quotable list` — see your projects
- `/quotable status <project>` — detailed progress
- `/quotable pause <project>` — stop sending questions
- `/quotable resume <project>` — resume

**Workflow**:
1. Bot sends outreach messages to participants
2. Participants accept and answer questions at their own pace
3. AI generates follow-up and cross-pollination questions
4. Saturation detector monitors when enough material is collected
5. Compile the article from the dashboard (3-pass AI compilation)
6. Send quotes to participants for approval before publishing
7. If a deadline is set, auto-compilation triggers with available material

### 7. Production Deployment
- Remove `SLACK_APP_TOKEN` to disable Socket Mode
- Set the **Events Request URL** in your Slack app to `https://your-domain.com/api/slack/events`
- Set the **Interactivity Request URL** to `https://your-domain.com/api/slack/interactivity`
- Set up hourly cron jobs:
  - `GET /api/cron/nudges?secret=YOUR_CRON_SECRET`
  - `GET /api/cron/auto-compile?secret=YOUR_CRON_SECRET`

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

### Quotable
- **Next.js 15 App Router** — dashboard UI + API routes
- **Slack Bolt.js** — handles Slack events, commands, interactive actions
- **Google Gemini** — Flash for fast tasks (follow-ups, audits), Pro for compilation
- **PostgreSQL + Drizzle ORM** — 8 tables (projects, participants, questions, exchanges, follow_up_threads, drafts, draft_quote_refs, quote_approvals)
- **BullMQ + Redis** — 4 job queues (answer-processing, question-sending, nudge, compilation)

### Frame Recommender
- **scikit-learn NearestNeighbors** — cosine similarity on encoded frame vectors
- **ColumnTransformer pipeline** — StandardScaler (numerical) + OneHotEncoder (categorical)
- **KMeans clustering** — discovers frame "archetypes" from order patterns
- **FastAPI** — REST API for serving recommendations
- **Adobe Commerce REST API** — paginated order fetching with custom option extraction
