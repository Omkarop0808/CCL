/**
 * Career World AI routing: Groq for realtime conversation; Gemini-only for structured doc/JSON tasks.
 * No Anthropic/Claude in production paths (see gemini.js callDeepReason).
 */

function getGroqKey() {
  return process.env.GROQ_API_KEY || '';
}

function getGroqModel() {
  return process.env.GROQ_MODEL || 'llama-3.1-70b-versatile';
}

function getGeminiKey() {
  return process.env.GEMINI_API_KEY || '';
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || 'gemini-3.8-flash';
}

async function readErrorBody(response) {
  try {
    const data = await response.json();
    return data?.error?.message || data?.error || data?.message || JSON.stringify(data);
  } catch {
    try {
      return await response.text();
    } catch {
      return '';
    }
  }
}

/**
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {{ maxTokens?: number, jsonMode?: boolean }} options
 */
export async function callGroqChat(systemPrompt, userPrompt, options = {}) {
  const key = getGroqKey();
  if (!key) {
    const geminiKey = getGeminiKey();
    if (geminiKey) {
      return await callGeminiText(systemPrompt, userPrompt, options.maxTokens ?? 1024);
    }
    throw new Error('Missing GROQ_API_KEY or GEMINI_API_KEY for conversational AI');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: options.maxTokens ?? 1024,
      temperature: 0.35,
      ...(options.jsonMode ? { response_format: { type: 'json_object' } } : {}),
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Groq API Error: ${body}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

export async function callGroqChatJSON(systemPrompt, userPrompt, maxTokens = 900) {
  const key = getGroqKey();
  if (!key) {
    const geminiKey = getGeminiKey();
    if (geminiKey) {
      return await callGeminiStructuredJSON(systemPrompt, userPrompt, maxTokens);
    }
    throw new Error('Missing GROQ_API_KEY or GEMINI_API_KEY');
  }
  const raw = await callGroqChat(systemPrompt, userPrompt, { maxTokens, jsonMode: true });
  const parsed = safeParseJSON(raw);
  if (!parsed) throw new Error('Groq returned non-JSON output');
  return parsed;
}

function safeParseJSON(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();

  // 1. Try to parse directly (covers pure JSON or API stripped mode)
  let cleaned = trimmed.replace(/```json\n?|\n?```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch (e1) {
    // 2. Fallback: try to extract substring between first { and last }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end >= start) {
      try {
        return JSON.parse(trimmed.substring(start, end + 1));
      } catch (e2) {
        return null; // Both failed
      }
    }
    return null;
  }
}

function isRetryableStatus(status) {
  return status === 429 || status === 500 || status === 503;
}

function isRetryableBody(message = '') {
  const m = String(message || '').toLowerCase();
  return m.includes('high demand') || m.includes('overloaded') || m.includes('temporar') || m.includes('rate limit');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Gemini only (no Groq) — document understanding + strict JSON. */
export async function callGeminiStructuredJSON(systemPrompt, userPrompt, maxTokens = 2048) {
  const key = getGeminiKey();
  const groqAvailable = Boolean(getGroqKey());
  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  let lastErr = '';

  if (key) {
    const candidateModels = [...new Set([model, 'gemini-flash-lite-latest', 'gemini-3.1-flash-lite', 'gemini-3.5-flash-lite'])];
    for (const curModel of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(curModel)}:generateContent?key=${key}`;
      let modelFailed = false;

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
            generationConfig: {
              maxOutputTokens: Math.max(maxTokens, 8192),
              temperature: 0.25,
              responseMimeType: 'application/json',
              thinkingConfig: {
                thinkingBudget: 0,
              },
            },
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
          console.log('--- GEMINI RAW OUTPUT LENGTH ---', raw.length);
          console.log('--- GEMINI FINISH REASON ---', data?.candidates?.[0]?.finishReason);
          console.log('--- GEMINI RAW OUTPUT ENDS WITH ---', raw.slice(-50));

          const parsed = safeParseJSON(raw);
          if (parsed) return parsed;

          console.log('--- GEMINI JSON PARSE FAILED. CALLING GROQ REPAIR ---');
          const repair = await callGroqChat(
            'You output only valid JSON. No markdown.',
            `Fix to valid JSON only:\n${raw}`,
            { maxTokens: 1200, jsonMode: true },
          ).catch(() => null);
          const again = repair ? safeParseJSON(repair) : null;
          if (again) return again;
          lastErr = 'Gemini returned non-JSON output.';
          modelFailed = true;
          break;
        }

        const body = await readErrorBody(response);
        lastErr = `Gemini API Error (${curModel}): ${body}`;

        if (response.status === 429 || body.toLowerCase().includes('quota')) {
          console.warn(`[CareerAI] Quota limit on ${curModel}, trying next model in cascade...`);
          modelFailed = true;
          break;
        }

        if ([500, 503].includes(response.status) && attempt < 1) {
          await sleep(2000);
          continue;
        }
        modelFailed = true;
        break;
      }
      if (!modelFailed) break;
    }
  } else {
    lastErr = 'Missing GEMINI_API_KEY for structured analysis';
  }

  if (groqAvailable) {
    const raw = await callGroqChat(
      `${systemPrompt}\n\nReturn valid JSON only.`,
      userPrompt,
      { maxTokens: Math.min(maxTokens, 4000), jsonMode: true },
    );
    const parsed = safeParseJSON(raw);
    if (parsed) return parsed;
  }

  throw new Error(lastErr || 'Structured AI is temporarily unavailable. Please try again.');
}

/** Plain text from Gemini (resume extraction, long-form parsing). */
export async function callGeminiText(systemPrompt, userPrompt, maxTokens = 4096) {
  const key = getGeminiKey();
  if (!key) throw new Error('Missing GEMINI_API_KEY');

  const model = getGeminiModel();
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${key}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
      generationConfig: { maxOutputTokens: maxTokens, temperature: 0.2 },
    }),
  });

  if (!response.ok) {
    const body = await readErrorBody(response);
    throw new Error(`Gemini API Error: ${body}`);
  }

  const data = await response.json();
  return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
}
