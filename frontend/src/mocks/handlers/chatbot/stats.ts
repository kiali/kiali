import { http, HttpResponse } from 'msw';
import {
  AITimeSeriesEntry,
  AITimeSeriesPoint,
  AITokenRow,
  AIUsageResponse,
  ChatSessionUsageMetric
} from '../../../types/Chatbot';

// ---------------------------------------------------------------------------
// Provider / model definitions with base hourly token load
// ---------------------------------------------------------------------------

interface ProviderModel {
  model: string;
  peakPromptTokens: number;
  completionRatio: number;
  provider: string;
  /**
   * Probability (0–1) that this model is used in any given business-hour bucket.
   * Heavy/default models are active most hours; niche/expensive models are sporadic.
   */
  activityProbability: number;
}

const PROVIDER_MODELS: ProviderModel[] = [
  // ── OpenAI — 3 models ──────────────────────────────────────────────────────
  { provider: 'openai', model: 'gpt-4o',      peakPromptTokens: 1400, completionRatio: 0.42, activityProbability: 0.80 },
  { provider: 'openai', model: 'gpt-4o-mini', peakPromptTokens: 1200, completionRatio: 0.38, activityProbability: 0.90 },
  { provider: 'openai', model: 'gpt-5.2',     peakPromptTokens: 1800, completionRatio: 0.45, activityProbability: 0.35 }, // expensive, used selectively

  // ── Anthropic — 3 models ───────────────────────────────────────────────────
  { provider: 'anthropic', model: 'claude-3-5-sonnet', peakPromptTokens:  960, completionRatio: 0.41, activityProbability: 0.65 },
  { provider: 'anthropic', model: 'claude-3-haiku',    peakPromptTokens: 1230, completionRatio: 0.40, activityProbability: 0.75 },
  { provider: 'anthropic', model: 'claude-haiku-4-5',  peakPromptTokens:  850, completionRatio: 0.39, activityProbability: 0.30 }, // newer, not fully adopted yet

  // ── Google — 2 models ─────────────────────────────────────────────────────
  { provider: 'google', model: 'gemini-2.5-pro',   peakPromptTokens: 1600, completionRatio: 0.44, activityProbability: 0.55 },
  { provider: 'google', model: 'gemini-2.0-flash', peakPromptTokens: 1100, completionRatio: 0.36, activityProbability: 0.70 },

  // ── Lightspeed — 2 models (on-prem, lower traffic) ────────────────────────
  { provider: 'lightspeed', model: 'granite-3-8b', peakPromptTokens: 630, completionRatio: 0.40, activityProbability: 0.50 },
  { provider: 'lightspeed', model: 'granite-3-3b', peakPromptTokens: 420, completionRatio: 0.38, activityProbability: 0.30 },
];

// ---------------------------------------------------------------------------
// Activity patterns
// ---------------------------------------------------------------------------

/**
 * Business-hours activity multiplier per hour of the day (0–23).
 * 1.0 = peak hour (around 11:00), 0.02 = deep night.
 */
const HOUR_ACTIVITY: number[] = [
  0.03, 0.02, 0.02, 0.01, 0.02, 0.05,   // 00–05  deep night
  0.12, 0.28, 0.58, 0.82, 0.96, 1.00,   // 06–11  morning ramp-up
  0.88, 0.92, 0.98, 0.96, 0.90, 0.72,   // 12–17  afternoon peak
  0.48, 0.32, 0.22, 0.14, 0.08, 0.05,   // 18–23  evening wind-down
];

/** Day-of-week multiplier (0 = Sunday … 6 = Saturday). */
const DAY_ACTIVITY: number[] = [0.12, 1.0, 1.0, 1.0, 1.0, 0.95, 0.12];

// ---------------------------------------------------------------------------
// Deterministic noise — same timestamp → same output, varies realistically
// ---------------------------------------------------------------------------

/**
 * Returns a value in [0, 1] that is deterministic for a given seed.
 * Uses a simple multiplicative hash so that close seeds produce varied outputs.
 */
const noise = (seed: number): number => {
  const s = Math.sin(seed * 9_301 + 49_297) * 233_280;
  return s - Math.floor(s);
};

// ---------------------------------------------------------------------------
// Token generator — produces synthetic tokens for one bucket
// ---------------------------------------------------------------------------

/**
 * Generates prompt/completion tokens for a single time bucket.
 *
 * @param bucketStart  Start of the bucket (ms since epoch)
 * @param stepSecs     Bucket width in seconds
 * @param pm           Provider/model definition
 */
/**
 * Returns whether this model was "active" (actually used) in this bucket.
 * Uses deterministic noise so the same bucket always gives the same answer,
 * creating a realistic sparse pattern across the day.
 */
const isModelActive = (pm: ProviderModel, bucketStart: number): boolean => {
  const d = new Date(bucketStart);
  const hour = d.getHours();
  // Models are never active during deep night regardless of probability.
  if (hour < 6 || hour > 22) return false;
  const actNoise = noise(bucketStart / 3_600_000 + pm.peakPromptTokens * 0.001 + pm.completionRatio * 100);
  return actNoise < pm.activityProbability;
};

const generateBucket = (
  bucketStart: number,
  stepSecs: number,
  pm: ProviderModel
): { completionTokens: number; promptTokens: number; totalTokens: number } => {
  // Respect sparse activity pattern — return zero if model was idle this bucket.
  if (!isModelActive(pm, bucketStart)) {
    return { completionTokens: 0, promptTokens: 0, totalTokens: 0 };
  }

  const d = new Date(bucketStart);
  const hour = d.getHours();
  const day  = d.getDay();

  const stepScale  = stepSecs / 3600;
  const activity   = HOUR_ACTIVITY[hour] * DAY_ACTIVITY[day];

  const nPrompt     = 0.75 + 0.50 * noise(bucketStart / 1_000_000 + pm.peakPromptTokens);
  const nCompletion = 0.75 + 0.50 * noise(bucketStart / 1_000_001 + pm.completionRatio * 1000);

  const promptTokens     = Math.round(pm.peakPromptTokens * activity * stepScale * nPrompt);
  const completionTokens = Math.round(promptTokens * pm.completionRatio * nCompletion);
  const totalTokens      = promptTokens + completionTokens;

  return { completionTokens, promptTokens, totalTokens };
};

// ---------------------------------------------------------------------------
// Static summary — computed ONCE at module load with a fixed reference time
// so the values never change between API calls regardless of the window param.
// ---------------------------------------------------------------------------

/** Fixed reference point: end of the 30-day all-time window. */
const STATIC_NOW_MS        = new Date('2026-07-17T00:00:00Z').getTime();
const SUMMARY_WINDOW_SECS  = 30 * 24 * 3_600;  // 30 days
const SUMMARY_STEP_SECS    = 3_600;             // 1-hour buckets for totals
const SPARKLINE_STEP_SECS  = 24 * 3_600;        // 1-day buckets for sparklines (30 points)

/** Deltas → cumulative; keep only strictly-increasing points. */
const cumulateBuckets = (buckets: AITimeSeriesPoint[]): AITimeSeriesPoint[] => {
  let cumPrompt = 0, cumCompletion = 0, cumTotal = 0;
  return buckets
    .map(p => {
      cumPrompt     += p.promptTokens;
      cumCompletion += p.completionTokens;
      cumTotal      += p.totalTokens;
      return { completionTokens: cumCompletion, promptTokens: cumPrompt, timestamp: p.timestamp, totalTokens: cumTotal };
    })
    .filter((p, i, arr) => p.totalTokens > 0 && (i === 0 || p.totalTokens > arr[i - 1].totalTokens));
};

// ── Compute static byModel totals (30-day hourly) ────────────────────────────
const summaryStartMs    = STATIC_NOW_MS - SUMMARY_WINDOW_SECS * 1_000;
const summaryNumBuckets = Math.ceil(SUMMARY_WINDOW_SECS / SUMMARY_STEP_SECS);

const staticModelMap = new Map<string, AITokenRow>();
PROVIDER_MODELS.forEach(pm => {
  let totalPrompt = 0, totalCompletion = 0, totalTotal = 0;
  for (let i = 0; i < summaryNumBuckets; i++) {
    const { promptTokens, completionTokens, totalTokens } =
      generateBucket(summaryStartMs + i * SUMMARY_STEP_SECS * 1_000, SUMMARY_STEP_SECS, pm);
    totalPrompt     += promptTokens;
    totalCompletion += completionTokens;
    totalTotal      += totalTokens;
  }
  if (totalTotal > 0) {
    staticModelMap.set(`${pm.provider}::${pm.model}`, {
      provider: pm.provider, model: pm.model,
      promptTokens: totalPrompt, completionTokens: totalCompletion, totalTokens: totalTotal,
    });
  }
});

const STATIC_BY_MODEL: AITokenRow[] = [...staticModelMap.values()]
  .sort((a, b) => `${a.provider}${a.model}`.localeCompare(`${b.provider}${b.model}`));

// ── Compute static byProvider totals + 30-day cumulative sparklines ───────────
const sparklineNumBuckets = Math.ceil(SUMMARY_WINDOW_SECS / SPARKLINE_STEP_SECS); // 30 points
const staticProviderMap   = new Map<string, { acc: { completionTokens: number; promptTokens: number; totalTokens: number }; deltas: AITimeSeriesPoint[] }>();

PROVIDER_MODELS.forEach(pm => {
  if (!staticProviderMap.has(pm.provider)) {
    staticProviderMap.set(pm.provider, {
      acc:    { completionTokens: 0, promptTokens: 0, totalTokens: 0 },
      deltas: Array.from({ length: sparklineNumBuckets }, (_, i) => ({
        completionTokens: 0, promptTokens: 0, totalTokens: 0,
        timestamp: new Date(summaryStartMs + i * SPARKLINE_STEP_SECS * 1_000).toISOString(),
      })),
    });
  }
  const entry = staticProviderMap.get(pm.provider)!;
  const row = staticModelMap.get(`${pm.provider}::${pm.model}`);
  if (row) {
    entry.acc.promptTokens     += row.promptTokens;
    entry.acc.completionTokens += row.completionTokens;
    entry.acc.totalTokens      += row.totalTokens;
  }
  // Accumulate daily deltas for sparkline.
  for (let i = 0; i < sparklineNumBuckets; i++) {
    const dayStart = summaryStartMs + i * SPARKLINE_STEP_SECS * 1_000;
    // Sum the 24 hourly buckets within this day.
    for (let h = 0; h < 24; h++) {
      const { promptTokens, completionTokens, totalTokens } =
        generateBucket(dayStart + h * 3_600_000, SUMMARY_STEP_SECS, pm);
      entry.deltas[i].promptTokens     += promptTokens;
      entry.deltas[i].completionTokens += completionTokens;
      entry.deltas[i].totalTokens      += totalTokens;
    }
  }
});

// Total deltas for the "total" provider sparkline.
const staticTotalDeltas: AITimeSeriesPoint[] = Array.from({ length: sparklineNumBuckets }, (_, i) => ({
  completionTokens: 0, promptTokens: 0, totalTokens: 0,
  timestamp: new Date(summaryStartMs + i * SPARKLINE_STEP_SECS * 1_000).toISOString(),
}));
staticProviderMap.forEach(entry => {
  entry.deltas.forEach((d, i) => {
    staticTotalDeltas[i].completionTokens += d.completionTokens;
    staticTotalDeltas[i].promptTokens     += d.promptTokens;
    staticTotalDeltas[i].totalTokens      += d.totalTokens;
  });
});

// Finalise static byProvider rows (totals never change; sparklines are 30-day cumulative).
const STATIC_BY_PROVIDER: AITokenRow[] = [...staticProviderMap.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([provider, { acc, deltas }]) => ({
    provider, ...acc, timeSeries: cumulateBuckets(deltas),
  }));
STATIC_BY_PROVIDER.push({
  provider: 'total',
  promptTokens:     STATIC_BY_PROVIDER.reduce((s, r) => s + r.promptTokens, 0),
  completionTokens: STATIC_BY_PROVIDER.reduce((s, r) => s + r.completionTokens, 0),
  totalTokens:      STATIC_BY_PROVIDER.reduce((s, r) => s + r.totalTokens, 0),
  timeSeries:       cumulateBuckets(staticTotalDeltas),
});

// ---------------------------------------------------------------------------
// Builder  –  windowSecs and stepSecs drive only the time-series chart data.
// ---------------------------------------------------------------------------

export const buildStatsResponse = (windowSecs = 86_400, stepSecs = 3_600): AIUsageResponse => {
  const now = Date.now();

  // ── Window-scoped time series (only this part depends on the window param) ───
  // Raw DELTA buckets are accumulated first, then cumulated once at the end.
  // This avoids the double-cumulation bug that occurs when cumulative values
  // are fed back into a second cumulateBuckets() call.
  const startMs    = now - windowSecs * 1_000;
  const numBuckets = Math.ceil(windowSecs / stepSecs);

  // Raw per-bucket deltas per (provider, model) — never cumulated yet.
  const rawDeltas = new Map<string, AITimeSeriesPoint[]>(); // key = "provider::model"
  const providerDeltas = new Map<string, AITimeSeriesPoint[]>(); // key = provider
  const totalDeltas: AITimeSeriesPoint[] = Array.from({ length: numBuckets }, (_, i) => ({
    completionTokens: 0, promptTokens: 0,
    timestamp: new Date(startMs + i * stepSecs * 1_000).toISOString(),
    totalTokens: 0,
  }));

  PROVIDER_MODELS.forEach(pm => {
    const modelKey = `${pm.provider}::${pm.model}`;
    const modelDeltas: AITimeSeriesPoint[] = Array.from({ length: numBuckets }, (_, i) => {
      const bucketStart = startMs + i * stepSecs * 1_000;
      const { completionTokens, promptTokens, totalTokens } = generateBucket(bucketStart, stepSecs, pm);
      return { completionTokens, promptTokens, timestamp: new Date(bucketStart).toISOString(), totalTokens };
    });
    rawDeltas.set(modelKey, modelDeltas);

    if (!providerDeltas.has(pm.provider)) {
      providerDeltas.set(pm.provider, Array.from({ length: numBuckets }, (_, i) => ({
        completionTokens: 0, promptTokens: 0,
        timestamp: new Date(startMs + i * stepSecs * 1_000).toISOString(),
        totalTokens: 0,
      })));
    }
    const pDelta = providerDeltas.get(pm.provider)!;
    modelDeltas.forEach((p, i) => {
      pDelta[i].completionTokens += p.completionTokens;
      pDelta[i].promptTokens     += p.promptTokens;
      pDelta[i].totalTokens      += p.totalTokens;
      totalDeltas[i].completionTokens += p.completionTokens;
      totalDeltas[i].promptTokens     += p.promptTokens;
      totalDeltas[i].totalTokens      += p.totalTokens;
    });
  });

  // ── Helper: deltas → cumulative, keep only strictly-increasing points ──────
  const cumulateBuckets = (buckets: AITimeSeriesPoint[]): AITimeSeriesPoint[] => {
    let cumPrompt = 0, cumCompletion = 0, cumTotal = 0;
    return buckets
      .map(p => {
        cumPrompt     += p.promptTokens;
        cumCompletion += p.completionTokens;
        cumTotal      += p.totalTokens;
        return { completionTokens: cumCompletion, promptTokens: cumPrompt, timestamp: p.timestamp, totalTokens: cumTotal };
      })
      .filter((p, i, arr) => p.totalTokens > 0 && (i === 0 || p.totalTokens > arr[i - 1].totalTokens));
  };

  // ── Build cumulative timeSeries.series ────────────────────────────────────
  const series: AITimeSeriesEntry[] = PROVIDER_MODELS
    .map(pm => {
      const modelKey = `${pm.provider}::${pm.model}`;
      const cumPoints = cumulateBuckets(rawDeltas.get(modelKey) ?? []);
      return { model: pm.model, points: cumPoints, provider: pm.provider };
    })
    .filter(s => s.points.length > 0);

  return {
    summary: {
      // Static: never changes regardless of window.
      byProvider: STATIC_BY_PROVIDER,
      byModel:    STATIC_BY_MODEL,
    },
    timeSeries: { window: String(windowSecs), step: String(stepSecs), series },
  };
};

// ---------------------------------------------------------------------------
// Session stats  –  mirrors GET /api/chat/session/usage response shape
// ---------------------------------------------------------------------------

const SESSION_STATS_BASE: ChatSessionUsageMetric[] = [
  {
    user_id: 'anonymous-shared',
    provider: 'anthropic',
    model: 'claude-haiku-4-5',
    request_count: 1,
    prompt_tokens: 5529,
    completion_tokens: 159,
    total_tokens: 5688,
    since: '2026-06-18T12:58:49.062972629+02:00',
    last_updated: '2026-06-18T12:58:49.062973226+02:00',
  },
  {
    user_id: 'anonymous-shared',
    provider: 'google',
    model: 'gemini-2.5-pro',
    request_count: 1,
    prompt_tokens: 4261,
    completion_tokens: 79,
    total_tokens: 4340,
    since: '2026-06-18T12:58:35.849550910+02:00',
    last_updated: '2026-06-18T12:58:35.849552995+02:00',
  },
  {
    user_id: 'anonymous-shared',
    provider: 'openai',
    model: 'gemini-2.5-pro',
    request_count: 1,
    prompt_tokens: 4263,
    completion_tokens: 36,
    total_tokens: 4539,
    since: '2026-06-18T13:00:47.507507145+02:00',
    last_updated: '2026-06-18T13:00:47.507507800+02:00',
  },
  {
    user_id: 'anonymous-shared',
    provider: 'openai',
    model: 'gpt-5.2',
    request_count: 1,
    prompt_tokens: 3569,
    completion_tokens: 121,
    total_tokens: 3690,
    since: '2026-06-18T12:59:02.399443589+02:00',
    last_updated: '2026-06-18T12:59:02.399444313+02:00',
  },
  {
    user_id: 'anonymous-shared',
    provider: 'openai',
    model: 'gpt-4o',
    request_count: 12,
    prompt_tokens: 18420,
    completion_tokens: 3870,
    total_tokens: 22290,
    since: '2026-06-18T08:15:00.000000000+02:00',
    last_updated: '2026-06-18T12:47:33.120000000+02:00',
  },
  {
    user_id: 'anonymous-shared',
    provider: 'anthropic',
    model: 'claude-3-5-sonnet',
    request_count: 5,
    prompt_tokens: 9100,
    completion_tokens: 2240,
    total_tokens: 11340,
    since: '2026-06-18T09:03:14.500000000+02:00',
    last_updated: '2026-06-18T11:58:01.330000000+02:00',
  } 
];

/**
 * Returns session-level token usage metrics, optionally filtered by provider,
 * model or user_id.
 */
export const buildSessionStats = (): ChatSessionUsageMetric[] => {
  return SESSION_STATS_BASE;
};

// ---------------------------------------------------------------------------
// MSW handlers
// ---------------------------------------------------------------------------
export const statsHandlers = [
  // GET /api/chat/usage?window=<seconds>&step=<seconds>
  http.get('*/api/chat/usage', ({ request }) => {
    const url = new URL(request.url);
    const windowSecs = Number(url.searchParams.get('window')) || 86400; // 24 hours
    const stepSecs   = Number(url.searchParams.get('step'))   || 3600;  // 1 hour
    return HttpResponse.json(buildStatsResponse(windowSecs, stepSecs));
  }),

  // GET /api/chat/session/usage
  http.get('*/api/chat/session/usage', () => {
    return HttpResponse.json(buildSessionStats());
  }),
];
