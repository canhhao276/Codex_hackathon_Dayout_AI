import express from 'express';
import cors from 'cors';
import { createStore } from './store.js';
import { fetchGooglePlace } from './googlePlaces.js';
import {
  extractShareCode,
  inferTargetStopOrder,
  normalizeGenerateRequest,
  normalizeItineraryResponse,
  normalizeReplanRequest,
} from './contract.js';
import {
  generateFallbackItinerary,
  getDemoItinerary,
  replanFallbackItinerary,
} from './fallbackPlanner.js';
import { callAiGenerate, callAiParseBrief, callAiReplan, checkAiHealth } from './aiClient.js';
import { renderNotFoundSharePage, renderSharePage } from './views/sharePage.js';
import { renderStatsDashboard } from './views/statsPage.js';

/**
 * Resolve public base URL dynamically so Cloudflare Quick Tunnel headers
 * automatically produce valid https://.../s/:code share links.
 */
export function resolveBaseUrl(req, configuredPublicBaseUrl = '', fallbackPort = 3000) {
  const explicit = String(configuredPublicBaseUrl || '').trim().replace(/\/+$/, '');
  if (explicit) return explicit;

  const forwardedProto = req.headers['x-forwarded-proto'];
  const proto = forwardedProto
    ? String(forwardedProto).split(',')[0].trim()
    : req.protocol || 'http';

  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost
    ? String(forwardedHost).split(',')[0].trim()
    : req.get('host') || `localhost:${fallbackPort}`;

  return `${proto}://${host}`.replace(/\/+$/, '');
}

/**
 * Create configured Express app instance for Dayout AI Node.js BFF.
 */
export function createApp(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 3000);
  const aiServiceUrl = String(
    options.aiServiceUrl ?? process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000',
  ).replace(/\/+$/, '');
  const publicBaseUrl = String(
    options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL ?? '',
  ).trim();
  const allowFallback =
    options.allowFallback !== undefined
      ? Boolean(options.allowFallback)
      : process.env.ALLOW_FALLBACK !== 'false';
  const rawAiTimeoutMs = options.aiTimeoutMs ?? process.env.AI_TIMEOUT_MS;
  const parsedAiTimeoutMs =
    rawAiTimeoutMs !== undefined && rawAiTimeoutMs !== null && String(rawAiTimeoutMs).trim() !== ''
      ? Number(rawAiTimeoutMs)
      : 10000;
  const aiTimeoutMs =
    Number.isFinite(parsedAiTimeoutMs) && parsedAiTimeoutMs > 0 ? parsedAiTimeoutMs : 10000;
  const useOsrm = options.useOsrm !== undefined ? Boolean(options.useOsrm) : true;

  const store = options.store || createStore(options.storePath);
  const demoParticipants = [...getDemoItinerary().participants];

  const app = express();
  app.set('trust proxy', true);
  app.use(cors({ exposedHeaders: ['X-AI-Source'] }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true }));

  const asyncHandler = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

  app.get('/', (req, res) => {
    const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
    res.json({
      service: 'Dayout AI — Node.js BFF & Viral Share Server',
      status: 'running',
      endpoints: {
        health: `${baseUrl}/health`,
        generate: `${baseUrl}/api/v1/itineraries/generate`,
        replan: `${baseUrl}/api/v1/itineraries/replan`,
        demo_share_card: `${baseUrl}/s/demo`,
        stats_json: `${baseUrl}/api/v1/stats`,
        stats_dashboard: `${baseUrl}/admin/stats`,
      },
    });
  });

  app.get(
    '/health',
    asyncHandler(async (req, res) => {
      const aiService = await checkAiHealth(aiServiceUrl);
      res.json({
        status: 'ok',
        service: 'dayout-ai-backend-node',
        port,
        allow_fallback: allowFallback,
        timestamp: new Date().toISOString(),
        ai_service: aiService,
      });
    }),
  );

  app.post(
    '/api/v1/itineraries/generate',
    asyncHandler(async (req, res) => {
      const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
      const normalizedReq = normalizeGenerateRequest(req.body);

      let rawAiResult = null;
      let aiSource = 'fastapi';

      try {
        rawAiResult = await callAiGenerate(aiServiceUrl, normalizedReq, {
          timeoutMs: aiTimeoutMs,
        });
        if (!rawAiResult || !Array.isArray(rawAiResult.stops) || rawAiResult.stops.length === 0) {
          throw new Error('Upstream AI returned empty stops');
        }
      } catch (err) {
        if (!allowFallback) {
          return res.status(502).json({
            error: 'AI service unavailable',
            detail: err?.message || 'Upstream FastAPI error',
          });
        }
        aiSource = 'fallback';
        rawAiResult = await generateFallbackItinerary(normalizedReq, { useOsrm });
      }

      const shortCode = store.generateShortCode();
      const shareUrl = `${baseUrl}/s/${shortCode}`;
      const candidateId =
        typeof rawAiResult?.itinerary_id === 'string' && rawAiResult.itinerary_id.trim()
          ? rawAiResult.itinerary_id.trim()
          : `itin_${Date.now().toString(36)}_${shortCode}`;

      const normalizedResponse = normalizeItineraryResponse(rawAiResult, {
        itineraryId: candidateId,
        shareUrl,
        fallbackBudgetVnd: normalizedReq.budget_vnd,
        origin: normalizedReq.origin,
      });

      const saved = store.saveNewItinerary(normalizedResponse, {
        shortCode,
        ai_source: aiSource,
      });

      const finalPayload = {
        ...saved.itinerary,
        itinerary_id: saved.itinerary_id,
        share_url: `${baseUrl}/s/${saved.shortCode}`,
      };

      res.setHeader('X-AI-Source', aiSource);
      return res.status(200).json(finalPayload);
    }),
  );

  app.post(
    '/api/v1/itineraries/replan',
    asyncHandler(async (req, res) => {
      const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
      const normalizedReplan = normalizeReplanRequest(req.body);
      const shareCodeHint = extractShareCode(
        normalizedReplan.current_itinerary?.share_url || normalizedReplan.share_url_hint,
      );

      const existingRecord =
        store.getById(normalizedReplan.itinerary_id) ||
        store.getById(normalizedReplan.current_itinerary?.itinerary_id) ||
        (shareCodeHint ? store.getByCode(shareCodeHint) : null);

      const currentItinerary =
        normalizedReplan.current_itinerary || existingRecord?.itinerary || null;

      if (!currentItinerary && !allowFallback) {
        return res.status(400).json({
          error: 'Missing current_itinerary or valid itinerary_id for replan',
        });
      }

      const targetStopOrder = normalizedReplan.has_explicit_target
        ? normalizedReplan.target_stop_order
        : inferTargetStopOrder(currentItinerary?.stops, normalizedReplan.reason);

      const replanInput = {
        ...normalizedReplan,
        target_stop_order: targetStopOrder,
      };

      let rawReplanResult = null;
      let aiSource = 'fastapi';

      try {
        if (!currentItinerary) {
          throw new Error('No base itinerary provided');
        }
        rawReplanResult = await callAiReplan(
          aiServiceUrl,
          {
            current_itinerary: currentItinerary,
            target_stop_order: targetStopOrder,
            reason: normalizedReplan.reason,
            ...(normalizedReplan.new_budget_vnd !== undefined
              ? { new_budget_vnd: normalizedReplan.new_budget_vnd }
              : {}),
          },
          { timeoutMs: aiTimeoutMs },
        );
        if (
          !rawReplanResult ||
          !Array.isArray(rawReplanResult.stops) ||
          rawReplanResult.stops.length === 0
        ) {
          throw new Error('Upstream AI returned empty stops');
        }
      } catch (err) {
        if (!allowFallback) {
          return res.status(502).json({
            error: 'AI replan service unavailable',
            detail: err?.message || 'Upstream FastAPI error',
          });
        }
        aiSource = 'fallback';
        rawReplanResult = await replanFallbackItinerary(replanInput, currentItinerary, {
          useOsrm,
        });
      }

      const basePolyline =
        Array.isArray(currentItinerary?.route_polyline) && currentItinerary.route_polyline.length > 0
          ? currentItinerary.route_polyline
          : existingRecord?.itinerary?.route_polyline;
      const rawOriginPt = Array.isArray(basePolyline?.[0]) ? basePolyline[0] : null;
      const originPoint =
        rawOriginPt &&
        rawOriginPt.length >= 2 &&
        rawOriginPt[0] !== null &&
        rawOriginPt[1] !== null &&
        typeof rawOriginPt[0] !== 'boolean' &&
        typeof rawOriginPt[1] !== 'boolean' &&
        String(rawOriginPt[0]).trim() !== '' &&
        String(rawOriginPt[1]).trim() !== '' &&
        Number.isFinite(Number(rawOriginPt[0])) &&
        Number.isFinite(Number(rawOriginPt[1]))
          ? { lat: Number(rawOriginPt[0]), lng: Number(rawOriginPt[1]) }
          : undefined;

      const prelim = normalizeItineraryResponse(rawReplanResult, {
        itineraryId: existingRecord?.itinerary_id || normalizedReplan.itinerary_id,
        shareUrl: existingRecord ? `${baseUrl}/s/${existingRecord.shortCode}` : undefined,
        fallbackBudgetVnd:
          normalizedReplan.new_budget_vnd ||
          currentItinerary?.summary?.budget_per_person_vnd ||
          350000,
        origin: originPoint,
      });

      const updated = store.updateReplannedItinerary(
        existingRecord?.itinerary_id || normalizedReplan.itinerary_id || shareCodeHint,
        prelim,
        normalizedReplan.reason,
        { ai_source: aiSource },
      );

      const finalPayload = {
        ...updated.itinerary,
        itinerary_id: updated.itinerary_id,
        share_url: `${baseUrl}/s/${updated.shortCode}`,
      };

      res.setHeader('X-AI-Source', aiSource);
      return res.status(200).json(finalPayload);
    }),
  );

  app.get('/s/:code', (req, res) => {
    const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
    const code = String(req.params.code || '').trim().toLowerCase();

    if (code === 'demo') {
      const demo = getDemoItinerary(baseUrl);
      demo.participants = [...demoParticipants];
      return res.status(200).type('html').send(
        renderSharePage({
          record: demo,
          itinerary: demo.itinerary,
          baseUrl,
        }),
      );
    }

    const record = store.recordShareView(code);
    if (!record) {
      return res.status(404).type('html').send(renderNotFoundSharePage(code, baseUrl));
    }

    const itineraryWithLiveUrl = {
      ...record.itinerary,
      share_url: `${baseUrl}/s/${record.shortCode}`,
    };

    return res.status(200).type('html').send(
      renderSharePage({
        record,
        itinerary: itineraryWithLiveUrl,
        baseUrl,
      }),
    );
  });

  app.get('/api/v1/share/:code', (req, res) => {
    const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
    const code = String(req.params.code || '').trim().toLowerCase();

    if (code === 'demo') {
      const demo = getDemoItinerary(baseUrl);
      demo.participants = [...demoParticipants];
      return res.json({
        code: 'demo',
        itinerary: demo.itinerary,
        participants: demo.participants,
        views: demo.views,
        replan_count: 0,
        created_at: demo.created_at,
        updated_at: demo.updated_at,
      });
    }

    const record = store.getByCode(code);
    if (!record) {
      return res.status(404).json({ error: 'Share code not found', code });
    }

    return res.json({
      code: record.shortCode,
      itinerary: {
        ...record.itinerary,
        share_url: `${baseUrl}/s/${record.shortCode}`,
      },
      participants: record.participants || [],
      views: record.views || 0,
      replan_count: record.replan_count || 0,
      created_at: record.created_at,
      updated_at: record.updated_at,
    });
  });

  app.post('/api/v1/share/:code/join', (req, res) => {
    const code = String(req.params.code || '').trim().toLowerCase();
    const { name, status, note } = req.body || {};
    const isHtmlForm = !req.is('application/json') && req.accepts(['json', 'html']) === 'html';

    if (code === 'demo') {
      const cleanName = typeof name === 'string' ? name.trim().slice(0, 50) : '';
      if (!cleanName) {
        if (isHtmlForm) {
          return res.redirect(303, '/s/demo');
        }
        return res.status(400).json({ error: 'Vui lòng nhập tên của bạn' });
      }
      const cleanStatus = ['going', 'coming_soon', 'suggest_change'].includes(status)
        ? status
        : 'going';
      const cleanNote = typeof note === 'string' ? note.trim().slice(0, 140) : '';
      const existing = demoParticipants.find(
        (p) => p.name.toLowerCase() === cleanName.toLowerCase(),
      );
      if (existing) {
        existing.status = cleanStatus;
        existing.note = cleanNote;
        existing.joined_at = new Date().toISOString();
      } else {
        demoParticipants.push({
          id: `pt_demo_${Date.now().toString(36)}`,
          name: cleanName,
          status: cleanStatus,
          note: cleanNote,
          joined_at: new Date().toISOString(),
        });
      }

      if (isHtmlForm) {
        return res.redirect(303, '/s/demo');
      }
      return res.status(200).json({
        ok: true,
        code: 'demo',
        participants_count: demoParticipants.length,
        participants: demoParticipants,
      });
    }

    try {
      const updated = store.addParticipant(code, { name, status, note });
      if (!updated) {
        if (isHtmlForm) {
          const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
          return res.status(404).type('html').send(renderNotFoundSharePage(code, baseUrl));
        }
        return res.status(404).json({ error: 'Share code not found', code });
      }

      if (isHtmlForm) {
        return res.redirect(303, `/s/${encodeURIComponent(updated.shortCode)}`);
      }

      return res.status(200).json({
        ok: true,
        code: updated.shortCode,
        participants_count: updated.participants.length,
        participants: updated.participants,
      });
    } catch (err) {
      if (err?.code === 'INVALID_NAME') {
        if (isHtmlForm) {
          return res.redirect(303, `/s/${encodeURIComponent(code)}`);
        }
        return res.status(400).json({ error: 'Vui lòng nhập tên của bạn' });
      }
      throw err;
    }
  });

  app.get(
    '/api/v1/stats',
    asyncHandler(async (req, res) => {
      const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
      const snapshot = store.getStatsSnapshot(baseUrl);
      const aiService = await checkAiHealth(aiServiceUrl);
      return res.json({
        ...snapshot,
        ai_service: aiService,
        timestamp: new Date().toISOString(),
      });
    }),
  );

  app.get(
    '/admin/stats',
    asyncHandler(async (req, res) => {
      const baseUrl = resolveBaseUrl(req, publicBaseUrl, port);
      const snapshot = store.getStatsSnapshot(baseUrl);
      const aiHealth = await checkAiHealth(aiServiceUrl);
      return res.status(200).type('html').send(
        renderStatsDashboard({
          stats: snapshot,
          aiHealth,
          baseUrl,
        }),
      );
    }),
  );

  // Mobile: người dùng gõ nhu cầu bằng lời → FastAPI phân tích → app điền sẵn form (người dùng vẫn sửa được).
  app.post(
    '/api/v1/brief/parse',
    asyncHandler(async (req, res) => {
      const text = typeof req.body?.text === 'string' ? req.body.text.trim().slice(0, 1000) : '';
      if (!text) return res.status(400).json({ error: 'Thiếu nội dung mô tả (text).' });
      try {
        const parsed = await callAiParseBrief(aiServiceUrl, { text });
        res.setHeader('X-AI-Source', parsed?.engine === 'openai' ? 'fastapi' : 'fallback');
        return res.status(200).json(parsed);
      } catch (err) {
        return res.status(502).json({
          error: 'AI service unavailable',
          detail: err?.message || 'Upstream FastAPI error',
        });
      }
    }),
  );

  // ---------- Ảnh & đánh giá địa điểm ----------
  // Google (ảnh, sao, 5 bình luận thật) nếu có GOOGLE_MAPS_API_KEY + đánh giá cộng đồng Dayout (người dùng thật gửi).
  const placeKeyOf = (src) => {
    const id = String(src?.stop_id || '').trim();
    if (id) return id.slice(0, 80);
    return String(src?.place_name || src?.name || '').trim().toLowerCase().slice(0, 80);
  };

  app.get(
    '/api/v1/places/reviews',
    asyncHandler(async (req, res) => {
      const q = req.query || {};
      const placeKey = placeKeyOf({ stop_id: q.stop_id, name: q.name });
      if (!placeKey) return res.status(400).json({ error: 'Thiếu stop_id hoặc name.' });
      const googleKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim();
      let google = null;
      let googleStatus = googleKey ? 'ok' : 'no_key';
      if (googleKey && q.name) {
        try {
          google = await fetchGooglePlace(
            { name: String(q.name), address: String(q.address || ''), lat: q.lat, lng: q.lng },
            googleKey,
          );
          if (!google) googleStatus = 'not_found';
        } catch (err) {
          googleStatus = 'error';
          console.warn('[places] Google Places failed:', err?.message);
        }
      }
      return res.status(200).json({
        place_key: placeKey,
        google,
        google_status: googleStatus,
        community: store.getPlaceReviews(placeKey),
      });
    }),
  );

  app.post('/api/v1/places/reviews', (req, res) => {
    const b = req.body || {};
    const placeKey = placeKeyOf(b);
    const rating = Number(b.rating);
    if (!placeKey) return res.status(400).json({ error: 'Thiếu stop_id hoặc place_name.' });
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'Số sao phải từ 1 đến 5.' });
    }
    const review = store.addPlaceReview(placeKey, {
      name: b.name,
      rating,
      comment: b.comment,
      place_name: b.place_name,
    });
    return res.status(201).json({ review, community: store.getPlaceReviews(placeKey) });
  });

  // Express JSON error handler (prevents malformed JSON or unexpected errors from crashing server)
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err?.type === 'entity.parse.failed' || err instanceof SyntaxError) {
      return res.status(400).json({ error: 'Invalid JSON payload' });
    }
    return res.status(err?.status || 500).json({
      error: 'Internal server error',
      detail: err?.message || 'Unexpected error',
    });
  });

  return app;
}
