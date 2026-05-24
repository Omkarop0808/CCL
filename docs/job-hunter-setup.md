# Job Hunter Setup (SAHAYA.AI + n8n)

This document explains how to run and verify the `Job Hunter` feature end-to-end on local Windows with n8n in Docker.

## What This Feature Adds

- New Career page: `Job Hunter`
- Backend module: `/api/job-hunter/*`
- n8n trigger integration (backend -> n8n)
- n8n callback integration (n8n -> backend webhook)
- Cover letter generation via Gemini
- WhatsApp summary notification (Twilio or Meta)

## Integration Plan

The feature is added as an isolated Career World module to avoid regressions:

1. Frontend route added at `/career/job-hunter`
2. Backend route namespace added at `/api/job-hunter/*`
3. User profile stores resume + target roles + filters
4. Starting a run creates a local run record first, then triggers n8n
5. n8n pushes job batches back into backend via webhook
6. UI reads runs/jobs from backend and generates cover letters on demand
7. WhatsApp notification is sent only when a run completes

This keeps scraping orchestration in n8n while SAHAYA.AI remains source-of-truth for user-facing data.

## Data Model Contract

The feature uses the existing `app_data_rows` / fallback JSON collection pattern:

- `job_hunter_profiles`
  - `id`
  - `userId`
  - `resumeText`
  - `resumeFileRef`
  - `targetRoles[]`
  - `filters`
  - `createdAt`
  - `updatedAt`

- `job_hunter_runs`
  - `id`
  - `runId`
  - `userId`
  - `status`
  - `triggerStatus`
  - `triggerNote`
  - `foundCount`
  - `error`
  - `metadata`
  - `createdAt`
  - `updatedAt`
  - `completedAt`

- `job_hunter_jobs`
  - `id`
  - `runId`
  - `userId`
  - `externalRef`
  - `title`
  - `company`
  - `location`
  - `url`
  - `description`
  - `postedAt`
  - `source`
  - `easyApply`
  - `skills[]`
  - `improvements[]`
  - `score`
  - `status`
  - `coverLetter`
  - `raw`
  - `createdAt`
  - `updatedAt`

## Risks And Mitigation

- **n8n unavailable**
  - Mitigation: run is still created locally; trigger response shows skipped/failed note.

- **Supabase unavailable**
  - Mitigation: existing DB helper falls back to local JSON collections.

- **Webhook abuse**
  - Mitigation: callback requires shared secret header.

- **Large or messy external job payloads**
  - Mitigation: webhook sanitizes and truncates external data before storage.

- **WhatsApp credentials missing**
  - Mitigation: completion stores dry-run metadata instead of failing the run.

- **Resume PDF extraction fails**
  - Mitigation: UI supports manual resume text paste and reuse of existing Resume Hub upload flow.

## Environment Variables

Add these in `backend/.env`:

```env
N8N_TRIGGER_WEBHOOK_URL=http://localhost:5678/webhook/job-hunter/trigger
JOB_HUNTER_RESULTS_WEBHOOK_SECRET=replace_with_strong_secret
JOB_HUNTER_GOOGLE_SHEETS_ENABLED=false

WHATSAPP_PROVIDER=twilio
WHATSAPP_TO_NUMBER=whatsapp:+91XXXXXXXXXX

# Twilio
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886

# Meta WhatsApp Cloud
META_WHATSAPP_PHONE_NUMBER_ID=
META_WHATSAPP_ACCESS_TOKEN=
```

## n8n Local Docker Notes

- Trigger URL called by backend can use host URL:
  - `http://localhost:5678/webhook/job-hunter/trigger`
- Callback URL called by n8n container to backend must use:
  - `http://host.docker.internal:5000/api/job-hunter/webhook/n8n`

## n8n Workflow Changes

Use two webhooks:

1) **Trigger Search** (backend -> n8n)
- Node path: `POST /webhook/job-hunter/trigger`
- Input payload:
  - `runId`
  - `userId`
  - `resumeText`
  - `targetRoles[]`
  - `filters`

2) **Results Callback** (n8n -> backend)
- Use HTTP Request node:
  - Method: `POST`
  - URL: `http://host.docker.internal:5000/api/job-hunter/webhook/n8n`
  - Header: `x-job-hunter-secret: <JOB_HUNTER_RESULTS_WEBHOOK_SECRET>`
  - Body format:

```json
{
  "eventType": "jobs_batch",
  "runId": "string",
  "userId": "string",
  "jobs": [
    {
      "externalId": "string",
      "title": "string",
      "company": "string",
      "location": "string",
      "url": "string",
      "description": "string",
      "postedAt": "string",
      "source": "linkedin",
      "easyApply": true,
      "skills": ["string"],
      "improvements": ["string"],
      "score": 84,
      "raw": {}
    }
  ],
  "meta": {}
}
```

Recommended event sequence:
- `run_started`
- one or more `jobs_batch`
- `run_completed` (or `run_failed`)

## API Contract

Base: `/api/job-hunter`

- `POST /profile` (auth)
  - Save/update profile:
    - `resumeText`
    - `resumeFileRef`
    - `targetRoles[]`
    - `filters`

- `GET /profile` (auth)

- `POST /run` (auth)
  - Creates `runId`
  - Sends payload to n8n trigger webhook

- `POST /run/:runId/stop` (auth)
  - Marks run as `cancel_requested`

- `GET /runs` (auth)

- `GET /jobs?runId=...` (auth)

- `PATCH /jobs/:jobId/status` (auth)
  - allowed statuses: `new`, `saved`, `applied`, `ignored`

- `POST /jobs/:jobId/cover-letter` (auth)
  - Uses Gemini to generate cover letter for selected job

- `POST /webhook/n8n` (no auth, protected by secret header)

## Frontend Location

- Route: `/career/job-hunter`
- Main file: `frontend/src/pages/career/JobHunter.jsx`

## Verification Checklist

1) Start backend and frontend.
2) Open Career -> Job Hunter.
3) Save profile with resume + target roles + filters.
4) Start run and verify run entry appears.
5) Simulate n8n webhook callback and verify jobs table updates.
6) Generate one cover letter.
7) Change job status.
8) Send completion event and check WhatsApp send/dry-run metadata in run.

## Verification Commands

### 1) Health

```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/health"
```

### 2) Register test user and token

```powershell
$email=("jobhunter"+[guid]::NewGuid().ToString("N").Substring(0,8)+"@example.com")
$body=@{name="Job Hunter User";email=$email;password="TestPass123!"} | ConvertTo-Json
$resp=Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/auth/register" -ContentType "application/json" -Body $body
$token=$resp.token
$headers=@{ Authorization=("Bearer "+$token) }
```

### 3) Save profile

```powershell
$payload=@{
  resumeText="Experienced software engineer with React and Node.js background."
  targetRoles=@("Frontend Developer","Full Stack Engineer")
  filters=@{
    keyword="React"
    location="Pune"
    experienceLevel="2-4 years"
    remote="hybrid"
    easyApply=$true
    excludeKeywords=@("PHP")
  }
} | ConvertTo-Json -Depth 6
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/job-hunter/profile" -Headers $headers -ContentType "application/json" -Body $payload
```

### 4) Start run

```powershell
$run=Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/job-hunter/run" -Headers $headers -ContentType "application/json" -Body "{}"
$runId=$run.runId
$runId
```

### 5) Simulate n8n jobs callback

```powershell
$secret="replace_with_JOB_HUNTER_RESULTS_WEBHOOK_SECRET"
$whHeaders=@{ "x-job-hunter-secret"=$secret }
$evt=@{
  eventType="jobs_batch"
  runId=$runId
  userId=$resp.user.id
  jobs=@(
    @{
      externalId="lnk-1"
      title="Frontend Engineer"
      company="Example Corp"
      location="Pune"
      url="https://example.com/jobs/1"
      description="React, JS, APIs"
      postedAt=(Get-Date).ToString("s")
      source="linkedin"
      easyApply=$true
      skills=@("React","JavaScript")
      improvements=@("Add measurable impact bullets")
      score=82
      raw=@{}
    }
  )
  meta=@{}
} | ConvertTo-Json -Depth 8
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/job-hunter/webhook/n8n" -Headers $whHeaders -ContentType "application/json" -Body $evt
```

### 6) Fetch jobs

```powershell
Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/api/job-hunter/jobs?runId="+$runId) -Headers $headers
```

### 7) Cover letter generation

```powershell
$jobs=Invoke-RestMethod -Method Get -Uri ("http://localhost:5000/api/job-hunter/jobs?runId="+$runId) -Headers $headers
$jobId=$jobs.jobs[0].id
Invoke-RestMethod -Method Post -Uri ("http://localhost:5000/api/job-hunter/jobs/"+$jobId+"/cover-letter") -Headers $headers -ContentType "application/json" -Body "{}"
```

### 8) Mark status

```powershell
Invoke-RestMethod -Method Patch -Uri ("http://localhost:5000/api/job-hunter/jobs/"+$jobId+"/status") -Headers $headers -ContentType "application/json" -Body (@{status="saved"} | ConvertTo-Json)
```

### 9) Complete run (triggers WhatsApp send/dry-run)

```powershell
$done=@{
  eventType="run_completed"
  runId=$runId
  userId=$resp.user.id
  jobs=@()
  meta=@{ note="manual completion" }
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "http://localhost:5000/api/job-hunter/webhook/n8n" -Headers $whHeaders -ContentType "application/json" -Body $done
```
