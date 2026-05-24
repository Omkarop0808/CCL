import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { authMiddleware } from '../middleware/auth.js';
import { findAll, findOne, insertOne, updateOne } from '../middleware/db.js';
import { callGemini } from '../services/gemini.js';

const router = express.Router();

const COL_PROFILE = 'job_hunter_profiles';
const COL_RUNS = 'job_hunter_runs';
const COL_JOBS = 'job_hunter_jobs';

const JOB_STATUSES = new Set(['new', 'saved', 'applied', 'ignored']);
const RUN_STATUSES = new Set(['queued', 'running', 'completed', 'failed', 'cancel_requested', 'cancelled']);

function nowIso() {
  return new Date().toISOString();
}

function normalizeRoles(roles) {
  if (!Array.isArray(roles)) return [];
  return [...new Set(roles.map((x) => String(x || '').trim()).filter(Boolean))].slice(0, 20);
}

function normalizeFilters(filters = {}) {
  return {
    keyword: String(filters.keyword || '').trim().slice(0, 200),
    location: String(filters.location || '').trim().slice(0, 200),
    experienceLevel: String(filters.experienceLevel || '').trim().slice(0, 100),
    remote: String(filters.remote || '').trim().slice(0, 32),
    easyApply: Boolean(filters.easyApply),
    githubUrl: String(filters.githubUrl || '').trim().slice(0, 500),
    linkedinUrl: String(filters.linkedinUrl || '').trim().slice(0, 500),
    portfolioUrl: String(filters.portfolioUrl || '').trim().slice(0, 500),
    preferredCompanies: Array.isArray(filters.preferredCompanies)
      ? filters.preferredCompanies.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 30)
      : [],
    excludeKeywords: Array.isArray(filters.excludeKeywords)
      ? filters.excludeKeywords.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20)
      : [],
  };
}

function firstNonEmptyString(...values) {
  for (const val of values) {
    const str = String(val ?? '').trim();
    if (str) return str;
  }
  return '';
}

function toBool(value) {
  if (typeof value === 'boolean') return value;
  const str = String(value ?? '').trim().toLowerCase();
  return ['1', 'true', 'yes', 'y'].includes(str);
}

function toNumberOrZero(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function normalizeEventType(value) {
  const raw = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (raw === 'start' || raw === 'started') return 'run_started';
  if (raw === 'complete' || raw === 'completed') return 'run_completed';
  if (raw === 'fail' || raw === 'failed') return 'run_failed';
  return raw;
}

function sanitizeJob(job = {}) {
  const url = firstNonEmptyString(job.url, job.jobUrl, job.job_url, job.link, job.applyUrl, job.apply_url);
  return {
    externalId: firstNonEmptyString(job.externalId, job.external_id, job.jobId, job.job_id, job.id).slice(0, 200),
    title: firstNonEmptyString(job.title, job.role, job.position, job.jobTitle, job.job_title).slice(0, 300),
    company: firstNonEmptyString(job.company, job.companyName, job.company_name, job.organization).slice(0, 300),
    location: firstNonEmptyString(job.location, job.city, job.geo, job.workplace).slice(0, 300),
    url: url.slice(0, 1000),
    description: firstNonEmptyString(job.description, job.summary, job.snippet, job.body).slice(0, 20000),
    postedAt: firstNonEmptyString(job.postedAt, job.posted_at, job.postedDate, job.datePosted).slice(0, 80),
    source: firstNonEmptyString(job.source, job.platform, job.provider, 'linkedin').slice(0, 80),
    easyApply: toBool(job.easyApply ?? job.easy_apply),
    skills: Array.isArray(job.skills) ? job.skills.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20) : [],
    improvements: Array.isArray(job.improvements) ? job.improvements.map((x) => String(x || '').trim()).filter(Boolean).slice(0, 20) : [],
    score: toNumberOrZero(job.score ?? job.matchScore ?? job.match_score),
    raw: job.raw ?? null,
  };
}

async function sendToN8n(payload) {
  const webhookUrl = process.env.N8N_TRIGGER_WEBHOOK_URL;
  if (!webhookUrl) {
    return { ok: false, skipped: true, reason: 'N8N_TRIGGER_WEBHOOK_URL is not set.' };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      return { ok: false, skipped: false, reason: `n8n trigger failed (${response.status}): ${text.slice(0, 300)}` };
    }
    return { ok: true, skipped: false, reason: text.slice(0, 300) || 'Triggered' };
  } catch (err) {
    return { ok: false, skipped: false, reason: `n8n trigger error: ${err.message}` };
  }
}

async function sendWhatsAppSummary({ userId, runId, jobs }) {
  const provider = String(process.env.WHATSAPP_PROVIDER || '').toLowerCase();
  if (!provider || !['twilio', 'meta'].includes(provider)) {
    return { sent: false, dryRun: true, provider: provider || 'none', reason: 'WHATSAPP_PROVIDER not configured' };
  }

  const top = jobs.slice(0, 3);
  const text = [
    `Job Hunter update: found ${jobs.length} jobs.`,
    ...top.map((j, i) => `${i + 1}. ${j.title || 'Role'} @ ${j.company || 'Company'} ${j.url || ''}`),
    `Run: ${runId}`,
  ].join('\n');

  if (provider === 'twilio') {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_WHATSAPP_FROM;
    const to = process.env.WHATSAPP_TO_NUMBER;
    if (!sid || !token || !from || !to) {
      return { sent: false, dryRun: true, provider, reason: 'Missing Twilio vars' };
    }
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const body = new URLSearchParams({
      From: from,
      To: to,
      Body: text,
    });
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });
    if (!res.ok) {
      const details = await res.text().catch(() => '');
      return { sent: false, dryRun: false, provider, reason: `Twilio failed (${res.status}): ${details.slice(0, 200)}` };
    }
    return { sent: true, dryRun: false, provider, reason: 'Twilio sent' };
  }

  const phoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.META_WHATSAPP_ACCESS_TOKEN;
  const to = process.env.WHATSAPP_TO_NUMBER;
  if (!phoneId || !accessToken || !to) {
    return { sent: false, dryRun: true, provider, reason: 'Missing Meta WhatsApp vars' };
  }
  const res = await fetch(`https://graph.facebook.com/v22.0/${encodeURIComponent(phoneId)}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: text },
    }),
  });
  if (!res.ok) {
    const details = await res.text().catch(() => '');
    return { sent: false, dryRun: false, provider, reason: `Meta WhatsApp failed (${res.status}): ${details.slice(0, 200)}` };
  }
  return { sent: true, dryRun: false, provider, reason: 'Meta sent' };
}

router.post('/profile', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const body = req.body || {};
    const profileDoc = {
      id: `${userId}__job_hunter_profile`,
      userId,
      resumeText: String(body.resumeText || '').slice(0, 120000),
      resumeFileRef: String(body.resumeFileRef || '').slice(0, 500),
      targetRoles: normalizeRoles(body.targetRoles),
      filters: normalizeFilters(body.filters),
      updatedAt: nowIso(),
      createdAt: nowIso(),
    };

    const existing = await findOne(COL_PROFILE, (x) => x.userId === userId);
    if (existing) {
      const updated = await updateOne(COL_PROFILE, (x) => x.userId === userId, { ...profileDoc, createdAt: existing.createdAt || existing.updatedAt || nowIso() });
      return res.json({ profile: updated });
    }
    await insertOne(COL_PROFILE, profileDoc);
    return res.json({ profile: profileDoc });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save profile' });
  }
});

router.get('/profile', authMiddleware, async (req, res) => {
  const profile = await findOne(COL_PROFILE, (x) => x.userId === req.userId);
  res.json({ profile: profile || null });
});

router.post('/run', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const profile = await findOne(COL_PROFILE, (x) => x.userId === userId);
    if (!profile) return res.status(400).json({ error: 'Create profile first.' });

    const runId = uuidv4();
    const run = {
      id: runId,
      runId,
      userId,
      status: 'queued',
      triggerStatus: 'pending',
      triggerNote: '',
      foundCount: 0,
      error: '',
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
      metadata: {},
    };
    await insertOne(COL_RUNS, run);

    const triggerPayload = {
      runId,
      userId,
      resumeText: profile.resumeText || '',
      targetRoles: profile.targetRoles || [],
      filters: profile.filters || {},
      callback: {
        url: process.env.JOB_HUNTER_CALLBACK_URL || '',
        secretHeader: 'x-job-hunter-secret',
        secret: process.env.JOB_HUNTER_RESULTS_WEBHOOK_SECRET || '',
      },
    };
    const trigger = await sendToN8n(triggerPayload);
    await updateOne(COL_RUNS, (x) => x.runId === runId && x.userId === userId, {
      triggerStatus: trigger.ok ? 'sent' : (trigger.skipped ? 'skipped' : 'failed'),
      triggerNote: trigger.reason || '',
      updatedAt: nowIso(),
    });

    res.json({ runId, status: 'queued', trigger });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to start run' });
  }
});

router.post('/run/:runId/stop', authMiddleware, async (req, res) => {
  const { runId } = req.params;
  const run = await updateOne(COL_RUNS, (x) => x.runId === runId && x.userId === req.userId, {
    status: 'cancel_requested',
    updatedAt: nowIso(),
  });
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json({ ok: true, run });
});

router.get('/runs', authMiddleware, async (req, res) => {
  const runs = await findAll(COL_RUNS, (x) => x.userId === req.userId);
  const jobs = await findAll(COL_JOBS, (x) => x.userId === req.userId);
  const counts = jobs.reduce((acc, job) => {
    acc[job.runId] = (acc[job.runId] || 0) + 1;
    return acc;
  }, {});
  const merged = runs
    .map((run) => ({ ...run, foundCount: counts[run.runId] || run.foundCount || 0 }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  res.json({ runs: merged });
});

router.get('/jobs', authMiddleware, async (req, res) => {
  const runId = String(req.query.runId || '').trim();
  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - ONE_WEEK_MS;

  const jobs = await findAll(COL_JOBS, (x) => {
    if (x.userId !== req.userId) return false;
    if (runId && x.runId !== runId) return false;
    const jobDate = new Date(x.postedAt || x.createdAt).getTime();
    if (jobDate < cutoff) return false;
    return true;
  });
  const sorted = jobs.sort((a, b) => new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime());
  res.json({ jobs: sorted });
});

router.patch('/jobs/:jobId/status', authMiddleware, async (req, res) => {
  const { jobId } = req.params;
  const status = String(req.body?.status || '').trim();
  if (!JOB_STATUSES.has(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  const updated = await updateOne(COL_JOBS, (x) => x.id === jobId && x.userId === req.userId, {
    status,
    updatedAt: nowIso(),
  });
  if (!updated) return res.status(404).json({ error: 'Job not found' });
  res.json({ job: updated });
});

router.post('/jobs/:jobId/cover-letter', authMiddleware, async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await findOne(COL_JOBS, (x) => x.id === jobId && x.userId === req.userId);
    if (!job) return res.status(404).json({ error: 'Job not found' });

    const profile = await findOne(COL_PROFILE, (x) => x.userId === req.userId);
    const resumeText = String(req.body?.resumeText || profile?.resumeText || '').slice(0, 20000);
    if (!resumeText.trim()) return res.status(400).json({ error: 'Resume text missing. Save profile first.' });

    const system = 'You are an expert job application assistant. Write concise, role-specific cover letters. Keep format professional and clear.';
    const prompt = `Target role(s): ${(profile?.targetRoles || []).join(', ') || 'General'}\nCompany: ${job.company}\nTitle: ${job.title}\nLocation: ${job.location}\nJob Description:\n${String(job.description || '').slice(0, 7000)}\n\nCandidate Resume:\n${resumeText}\n\nWrite a personalized cover letter in plain text with 4 short paragraphs.`;
    const coverLetter = await callGemini(system, prompt, { maxTokens: 1200 });

    const updated = await updateOne(COL_JOBS, (x) => x.id === jobId && x.userId === req.userId, {
      coverLetter: String(coverLetter || '').slice(0, 12000),
      updatedAt: nowIso(),
    });
    res.json({ coverLetter: updated?.coverLetter || '' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Failed to generate cover letter' });
  }
});

router.post('/webhook/n8n', async (req, res) => {
  try {
    const expected = process.env.JOB_HUNTER_RESULTS_WEBHOOK_SECRET || '';
    const got = String(req.headers['x-job-hunter-secret'] || '');
    if (!expected || got !== expected) {
      return res.status(401).json({ error: 'Unauthorized webhook' });
    }

    const body = req.body || {};
    const eventType = normalizeEventType(body.eventType || body.event || body.event_type || body.type);
    const runId = firstNonEmptyString(body.runId, body.run_id, body.id);
    const userIdFromPayload = firstNonEmptyString(body.userId, body.user_id);
    const meta = body.meta || {};
    let inputJobs = [];
    if (Array.isArray(body.jobs)) inputJobs = body.jobs;
    else if (Array.isArray(body.results)) inputJobs = body.results;
    else if (Array.isArray(body.items)) inputJobs = body.items;
    else if (Array.isArray(body?.data?.jobs)) inputJobs = body.data.jobs;
    else if (body.job && typeof body.job === 'object') inputJobs = [body.job];
    if (!eventType || !runId) {
      return res.status(400).json({ error: 'eventType and runId are required' });
    }

    const run = await findOne(COL_RUNS, (x) => x.runId === runId && (!userIdFromPayload || x.userId === userIdFromPayload));
    if (!run) return res.status(404).json({ error: 'Run not found' });
    const userId = run.userId;
    if (!RUN_STATUSES.has(run.status)) {
      return res.status(400).json({ error: 'Invalid run state' });
    }

    if (eventType === 'run_started') {
      await updateOne(COL_RUNS, (x) => x.runId === runId && x.userId === userId, {
        status: 'running',
        updatedAt: nowIso(),
        metadata: { ...(run.metadata || {}), runStartedMeta: meta },
      });
      return res.json({ ok: true });
    }

    if (eventType === 'jobs_batch') {
      let inserted = 0;
      for (const rawJob of inputJobs.slice(0, 200)) {
        const safe = sanitizeJob(rawJob);
        const externalRef = safe.externalId || safe.url || `${safe.title}__${safe.company}`;
        const existing = await findOne(COL_JOBS, (x) => x.runId === runId && x.userId === userId && x.externalRef === externalRef);
        if (existing) {
          await updateOne(COL_JOBS, (x) => x.id === existing.id, {
            ...safe,
            externalRef,
            updatedAt: nowIso(),
          });
          continue;
        }
        const doc = {
          id: uuidv4(),
          runId,
          userId,
          externalRef,
          status: 'new',
          createdAt: nowIso(),
          updatedAt: nowIso(),
          coverLetter: '',
          ...safe,
        };
        await insertOne(COL_JOBS, doc);
        inserted += 1;
      }

      const allJobs = await findAll(COL_JOBS, (x) => x.runId === runId && x.userId === userId);
      await updateOne(COL_RUNS, (x) => x.runId === runId && x.userId === userId, {
        status: 'running',
        foundCount: allJobs.length,
        updatedAt: nowIso(),
      });
      return res.json({ ok: true, inserted, total: allJobs.length });
    }

    if (eventType === 'run_completed') {
      const allJobs = await findAll(COL_JOBS, (x) => x.runId === runId && x.userId === userId);
      const whatsapp = await sendWhatsAppSummary({ userId, runId, jobs: allJobs });
      await updateOne(COL_RUNS, (x) => x.runId === runId && x.userId === userId, {
        status: 'completed',
        foundCount: allJobs.length,
        completedAt: nowIso(),
        updatedAt: nowIso(),
        metadata: { ...(run.metadata || {}), completionMeta: meta, whatsapp },
      });
      return res.json({ ok: true, foundCount: allJobs.length, whatsapp });
    }

    if (eventType === 'run_failed') {
      await updateOne(COL_RUNS, (x) => x.runId === runId && x.userId === userId, {
        status: 'failed',
        error: String(meta?.error || body.error || 'run_failed').slice(0, 600),
        completedAt: nowIso(),
        updatedAt: nowIso(),
      });
      return res.json({ ok: true });
    }

    return res.status(400).json({ error: 'Unsupported eventType' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Webhook handling failed' });
  }
});

export default router;
