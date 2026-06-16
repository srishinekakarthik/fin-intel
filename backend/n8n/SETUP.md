# n8n Cloud — Document Ingestion Workflow Setup

## Import the workflow

1. Open n8n Cloud → **Workflows** → **Import from file**
2. Select `n8n/document-ingestion-workflow.json`

---

## Configure credentials

### Supabase
1. In n8n → **Credentials** → **New** → search "Supabase"
2. Enter your **Supabase URL** and **Service Role Key** (not anon key)
3. Name it exactly: `Supabase account`

### Google Gemini
1. In n8n → **Credentials** → **New** → search "Google Gemini"
2. Enter your **GOOGLE_GEMINI_API_KEY**
3. Name it exactly: `Google Gemini API`

---

## Set n8n environment variables

In n8n Cloud → **Settings** → **Environment Variables**, add:

| Variable | Value |
|---|---|
| `BACKEND_URL` | Your backend URL e.g. `https://your-api.fly.dev` or `http://localhost:3001` for dev |
| `N8N_CALLBACK_SECRET` | Same random string as `N8N_CALLBACK_SECRET` in your backend `.env` |

---

## Get the webhook path

1. Open the imported workflow
2. Click the **"Webhook: Receive from Backend"** node
3. Copy the **Webhook URL** — it looks like:
   `https://your-instance.app.n8n.cloud/webhook/fin-intel-ingest`
4. The path segment is `fin-intel-ingest` (or the UUID if you didn't rename it)
5. Set in backend `.env`:
   ```
   N8N_WEBHOOK_BASE_URL=https://your-instance.app.n8n.cloud/webhook
   N8N_INGESTION_WEBHOOK_PATH=fin-intel-ingest
   ```

---

## How the workflow runs

```
Backend webhook call (POST with documentId, orgId, signedUrl)
        │
        ├── Respond: Acknowledge  ──→  immediately returns 200 to backend
        │
        └── HTTP Request: Download PDF  ──→  pulls PDF from Supabase Storage
                    │
                    └── Supabase Vector Store: Insert Chunks
                              ├── Default Data Loader  (extracts text per page)
                              ├── Character Text Splitter  (2000 chars / 200 overlap)
                              └── Embeddings: Gemini text-embedding-004  (768 dims)
                                        │
                                    Code: Build Stats
                                        │
                              HTTP Request: Callback Success
                              POST /api/v1/documents/:id/ingestion-complete
                              → backend marks document status = 'ready'
```

---

## Important: table name

The Supabase Vector Store node must point to `document_chunks` (not `documents`).
The `documents` table stores metadata only. The `document_chunks` table holds the vectors.

In the Supabase Vector Store node:
- **Table name:** `document_chunks`
- **Query name:** `search_document_chunks`

---

## Error handling

If any node fails, the **Code: Build Error Payload** + **HTTP Request: Callback Failed** nodes
call `POST /api/v1/documents/:id/ingestion-failed` so the backend marks the document as `failed`
and the user sees the error in the frontend.

To wire up error handling in n8n:
1. In each main node, click **Settings** → **On Error** → **Continue (using error output)**
2. Connect error outputs to the **Code: Build Error Payload** node

---

## Testing locally

Use [ngrok](https://ngrok.com) to expose your local backend:
```bash
ngrok http 3001
```
Then set `BACKEND_URL=https://your-ngrok-url.ngrok.io` in n8n environment variables.
