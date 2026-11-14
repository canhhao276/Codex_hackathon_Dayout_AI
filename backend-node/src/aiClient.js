/**
 * Check FastAPI AI & Spatial service health endpoint (:8000/health).
 */
export async function checkAiHealth(aiServiceUrl, { timeoutMs = 1500 } = {}) {
  const base = String(aiServiceUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const started = Date.now();
  try {
    const res = await fetch(`${base}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(timeoutMs),
    });
    const latency_ms = Date.now() - started;
    let detail = null;
    try {
      detail = await res.json();
    } catch {
      detail = null;
    }
    return {
      online: res.ok,
      status_code: res.status,
      latency_ms,
      url: base,
      detail,
    };
  } catch (err) {
    return {
      online: false,
      status_code: null,
      latency_ms: Date.now() - started,
      url: base,
      detail: err?.message || 'Unreachable',
    };
  }
}

async function postJson(url, body, timeoutMs) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    const err = new Error(`AI upstream HTTP ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

function resolveAiTimeoutMs(explicitTimeoutMs) {
  const raw = explicitTimeoutMs ?? process.env.AI_TIMEOUT_MS;
  const candidate =
    raw !== undefined && raw !== null && String(raw).trim() !== '' ? Number(raw) : 10000;
  return Number.isFinite(candidate) && candidate > 0 ? candidate : 10000;
}

/**
 * Forward itinerary generation request to FastAPI POST /ai/generate.
 */
export async function callAiGenerate(aiServiceUrl, payload, { timeoutMs } = {}) {
  const base = String(aiServiceUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  return postJson(`${base}/ai/generate`, payload, resolveAiTimeoutMs(timeoutMs));
}

/**
 * Forward itinerary replan request to FastAPI POST /ai/replan
 * (retaining /ai/replan-stop retry if /ai/replan returns 404).
 */
export async function callAiReplan(aiServiceUrl, payload, { timeoutMs } = {}) {
  const base = String(aiServiceUrl || 'http://127.0.0.1:8000').replace(/\/+$/, '');
  const effectiveTimeout = resolveAiTimeoutMs(timeoutMs);
  try {
    return await postJson(`${base}/ai/replan`, payload, effectiveTimeout);
  } catch (err) {
    if (err?.status === 404) {
      return postJson(`${base}/ai/replan-stop`, payload, effectiveTimeout);
    }
    throw err;
  }
}
