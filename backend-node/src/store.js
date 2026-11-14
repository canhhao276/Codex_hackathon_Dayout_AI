import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const REASON_KEYS = new Set([
  'rainy_weather',
  'crowded',
  'tighter_budget',
  'lower_calories',
]);

function createEmptyStore() {
  return {
    stats: {
      total_itineraries_generated: 0,
      total_replans: 0,
      replan_reasons: {
        rainy_weather: 0,
        crowded: 0,
        tighter_budget: 0,
        lower_calories: 0,
        other: 0,
      },
      total_share_views: 0,
      total_participants_joined: 0,
    },
    itineraries: {},
    codes: {},
  };
}

function hydrateStore(parsed) {
  const base = createEmptyStore();
  if (!parsed || typeof parsed !== 'object') return base;
  const parsedStats = parsed.stats || {};
  return {
    stats: {
      total_itineraries_generated: Number(parsedStats.total_itineraries_generated) || 0,
      total_replans: Number(parsedStats.total_replans) || 0,
      replan_reasons: {
        ...base.stats.replan_reasons,
        ...(parsedStats.replan_reasons || {}),
      },
      total_share_views: Number(parsedStats.total_share_views) || 0,
      total_participants_joined: Number(parsedStats.total_participants_joined) || 0,
    },
    itineraries: parsed.itineraries && typeof parsed.itineraries === 'object' ? parsed.itineraries : {},
    codes: parsed.codes && typeof parsed.codes === 'object' ? parsed.codes : {},
  };
}

/**
 * Create a JSON-file backed store for itineraries, share codes, participants, and analytics.
 * Uses atomic temp-file writes so partial writes never corrupt hackathon demo state.
 */
export function createStore(storeFilePath = path.resolve(process.cwd(), 'data', 'store.json')) {
  const dir = path.dirname(storeFilePath);
  fs.mkdirSync(dir, { recursive: true });

  let state = createEmptyStore();
  if (fs.existsSync(storeFilePath)) {
    try {
      const raw = fs.readFileSync(storeFilePath, 'utf8');
      if (raw.trim()) {
        state = hydrateStore(JSON.parse(raw));
      }
    } catch {
      state = createEmptyStore();
    }
  } else {
    persist();
  }

  function persist() {
    fs.mkdirSync(dir, { recursive: true });
    const tmpPath = `${storeFilePath}.${process.pid}.${crypto.randomBytes(3).toString('hex')}.tmp`;
    fs.writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
    fs.renameSync(tmpPath, storeFilePath);
  }

  function generateShortCode() {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      let code = '';
      for (let i = 0; i < 5; i += 1) {
        code += CODE_ALPHABET[crypto.randomInt(0, CODE_ALPHABET.length)];
      }
      if (!state.codes[code] && code !== 'demo') {
        return code;
      }
    }
    return `d${Date.now().toString(36).slice(-4)}`;
  }

  function saveNewItinerary(itinerary, meta = {}) {
    const shortCode = meta.shortCode && !state.codes[meta.shortCode]
      ? String(meta.shortCode).toLowerCase()
      : generateShortCode();
    let itineraryId = itinerary?.itinerary_id
      ? String(itinerary.itinerary_id)
      : `itin_${Date.now().toString(36)}_${shortCode}`;
    if (state.itineraries[itineraryId]) {
      itineraryId = `${itineraryId}_${shortCode}`;
    }

    const now = new Date().toISOString();
    const normalizedItinerary = {
      ...itinerary,
      itinerary_id: itineraryId,
    };

    const record = {
      itinerary_id: itineraryId,
      shortCode,
      itinerary: normalizedItinerary,
      participants: [],
      views: 0,
      replan_count: 0,
      ai_source: meta.ai_source || 'fastapi',
      created_at: now,
      updated_at: now,
    };

    state.itineraries[itineraryId] = record;
    state.codes[shortCode] = itineraryId;
    state.stats.total_itineraries_generated += 1;
    persist();
    return record;
  }

  function resolveExistingRecord(existingIdOrCode) {
    if (!existingIdOrCode) return null;
    const key = String(existingIdOrCode);
    if (state.itineraries[key]) return state.itineraries[key];
    const mappedId = state.codes[key.toLowerCase()];
    if (mappedId && state.itineraries[mappedId]) return state.itineraries[mappedId];
    return null;
  }

  function updateReplannedItinerary(existingIdOrCode, itinerary, reason, meta = {}) {
    const now = new Date().toISOString();
    const bucket = REASON_KEYS.has(reason) ? reason : 'other';
    let record = resolveExistingRecord(existingIdOrCode) || resolveExistingRecord(itinerary?.itinerary_id);

    if (record) {
      record.itinerary = {
        ...itinerary,
        itinerary_id: record.itinerary_id,
      };
      record.replan_count = (Number(record.replan_count) || 0) + 1;
      record.ai_source = meta.ai_source || record.ai_source || 'fastapi';
      record.updated_at = now;
    } else {
      const shortCode = generateShortCode();
      const itineraryId = itinerary?.itinerary_id
        ? String(itinerary.itinerary_id)
        : `itin_${Date.now().toString(36)}_${shortCode}`;
      record = {
        itinerary_id: itineraryId,
        shortCode,
        itinerary: {
          ...itinerary,
          itinerary_id: itineraryId,
        },
        participants: [],
        views: 0,
        replan_count: 1,
        ai_source: meta.ai_source || 'fastapi',
        created_at: now,
        updated_at: now,
      };
      state.itineraries[itineraryId] = record;
      state.codes[shortCode] = itineraryId;
    }

    state.stats.total_replans += 1;
    state.stats.replan_reasons[bucket] = (Number(state.stats.replan_reasons[bucket]) || 0) + 1;
    persist();
    return record;
  }

  function getByCode(code) {
    if (!code) return null;
    const id = state.codes[String(code).toLowerCase()];
    return id ? state.itineraries[id] || null : null;
  }

  function getById(itineraryId) {
    if (!itineraryId) return null;
    return state.itineraries[String(itineraryId)] || null;
  }

  function recordShareView(code) {
    const record = getByCode(code);
    if (!record) return null;
    record.views = (Number(record.views) || 0) + 1;
    state.stats.total_share_views += 1;
    persist();
    return record;
  }

  function addParticipant(code, { name, status = 'going', note = '' } = {}) {
    const record = getByCode(code);
    if (!record) return null;

    const cleanName = typeof name === 'string' ? name.trim().slice(0, 50) : '';
    if (!cleanName) {
      const err = new Error('Participant name is required');
      err.code = 'INVALID_NAME';
      throw err;
    }

    const allowedStatuses = new Set(['going', 'coming_soon', 'suggest_change']);
    const cleanStatus = allowedStatuses.has(status) ? status : 'going';
    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 140) : '';
    const now = new Date().toISOString();

    if (!Array.isArray(record.participants)) {
      record.participants = [];
    }

    const existing = record.participants.find(
      (p) => p.name.toLowerCase() === cleanName.toLowerCase(),
    );

    if (existing) {
      existing.name = cleanName;
      existing.status = cleanStatus;
      existing.note = cleanNote;
      existing.joined_at = now;
    } else {
      record.participants.push({
        id: `pt_${crypto.randomBytes(4).toString('hex')}`,
        name: cleanName,
        status: cleanStatus,
        note: cleanNote,
        joined_at: now,
      });
      state.stats.total_participants_joined += 1;
    }

    record.updated_at = now;
    persist();
    return record;
  }

  function getStatsSnapshot(baseUrl = 'http://localhost:3000') {
    const cleanBase = String(baseUrl).replace(/\/+$/, '');
    const records = Object.values(state.itineraries)
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 12)
      .map((rec) => {
        const summary = rec.itinerary?.summary || {};
        return {
          itinerary_id: rec.itinerary_id,
          title: summary.title || 'Lịch trình Dayout AI',
          share_code: rec.shortCode,
          share_url: `${cleanBase}/s/${rec.shortCode}`,
          budget: Number(summary.budget_per_person_vnd) || 0,
          cost: Number(summary.total_cost_per_person_vnd) || 0,
          calories: Number(summary.total_calories_kcal) || 0,
          stops_count: Array.isArray(rec.itinerary?.stops) ? rec.itinerary.stops.length : 0,
          participants_count: Array.isArray(rec.participants) ? rec.participants.length : 0,
          views: Number(rec.views) || 0,
          replan_count: Number(rec.replan_count) || 0,
          ai_source: rec.ai_source || 'fastapi',
          updated_at: rec.updated_at,
        };
      });

    return {
      total_itineraries_generated: state.stats.total_itineraries_generated,
      total_replans: state.stats.total_replans,
      replan_reasons: { ...state.stats.replan_reasons },
      total_share_views: state.stats.total_share_views,
      total_participants_joined: state.stats.total_participants_joined,
      estimated_active_users:
        state.stats.total_itineraries_generated + state.stats.total_participants_joined,
      recent_itineraries: records,
    };
  }

  return {
    generateShortCode,
    saveNewItinerary,
    updateReplannedItinerary,
    getByCode,
    getById,
    recordShareView,
    addParticipant,
    getStatsSnapshot,
  };
}
