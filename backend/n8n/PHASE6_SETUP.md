# Phase 6 — n8n Cloud Setup: Monitoring Workflow

## Import the workflow

1. n8n Cloud → **Workflows** → **Import from file**
2. Select `n8n/monitoring-workflow.json`

---

## Environment variables (same as Phase 5)

Already set if you completed Phase 5:

| Variable | Value |
|---|---|
| `BACKEND_URL` | Your backend URL |
| `N8N_CALLBACK_SECRET` | Same secret as backend `.env` |

---

## What this workflow does

```
Cron: Daily 7am UTC
   │
   ├── Fetch active orgs (GET /api/v1/reports/active-orgs)
   │
   └── For each org:
         POST /api/v1/alerts/monitor/sec
            │
            ├── Looks up CIK for each tracked company's ticker
            ├── Fetches latest 10-K/10-Q/8-K from SEC EDGAR
            ├── If new filing found → Gemini summarizes it
            ├── Creates an `alerts` row (type: sec_filing)
            │
            └── If alertsCreated > 0 → POST /api/v1/reports/notify


Cron: Every 6 hours
   │
   └── For each org:
         POST /api/v1/alerts/monitor/news
            │
            ├── Fetches recent Finnhub news per tracked company
            ├── Gemini summarizes significant articles
            ├── Creates `alerts` rows (type: news)
            │
            └── If alertsCreated > 0 → POST /api/v1/reports/notify
```

---

## Required backend env vars (already in .env.example)

```bash
FINNHUB_API_KEY=your-finnhub-key       # required for news monitoring
N8N_CALLBACK_SECRET=same-as-n8n        # shared secret
```

SEC EDGAR requires **no API key** — it's a free public API, but requires a
descriptive `User-Agent` header (already set in `sec-edgar.ts`).

---

## Testing

Manually trigger the monitors without waiting for the cron schedule:

```bash
curl -X POST $BACKEND_URL/api/v1/alerts/monitor/sec \
  -H "Content-Type: application/json" \
  -H "X-Callback-Secret: $N8N_CALLBACK_SECRET" \
  -d '{"orgId": "your-org-id"}'

curl -X POST $BACKEND_URL/api/v1/alerts/monitor/news \
  -H "Content-Type: application/json" \
  -H "X-Callback-Secret: $N8N_CALLBACK_SECRET" \
  -d '{"orgId": "your-org-id"}'
```

Check results in the Alerts page in the UI, or:

```bash
curl $BACKEND_URL/api/v1/alerts -H "Authorization: Bearer $ACCESS_TOKEN"
```

---

## Deduplication

Both monitors check `alerts.metadata` (JSONB) for existing entries before
inserting — SEC filings are deduped by `accessionNumber`, news by `url`.
Running the monitor repeatedly will not create duplicate alerts.
