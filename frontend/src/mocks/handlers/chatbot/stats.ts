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
  /** Peak hourly prompt tokens for this model at 100% activity */
  peakPromptTokens: number;
  /** Completion tokens as a fraction of prompt tokens */
  completionRatio: number;
  provider: string;
}

const PROVIDER_MODELS: ProviderModel[] = [
  { provider: 'openai',     model: 'gpt-4o',             peakPromptTokens: 1400, completionRatio: 0.42 },
  { provider: 'openai',     model: 'gpt-4o-mini',        peakPromptTokens: 1200, completionRatio: 0.40 },
  { provider: 'anthropic',  model: 'claude-3-5-sonnet',  peakPromptTokens: 960,  completionRatio: 0.41 },
  { provider: 'anthropic',  model: 'claude-3-haiku',     peakPromptTokens: 1230, completionRatio: 0.40 },
  { provider: 'lightspeed', model: 'granite-3-8b',       peakPromptTokens: 630,  completionRatio: 0.40 },
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
const generateBucket = (
  bucketStart: number,
  stepSecs: number,
  pm: ProviderModel
): { completionTokens: number; promptTokens: number; totalTokens: number } => {
  const d = new Date(bucketStart);
  const hour = d.getHours();
  const day  = d.getDay();

  // Scale peak load by step duration (a 5m step accumulates less than 1h)
  const stepScale  = stepSecs / 3600;
  const activity   = HOUR_ACTIVITY[hour] * DAY_ACTIVITY[day];

  // Two independent noise terms so prompt and completion vary independently
  const nPrompt     = 0.75 + 0.50 * noise(bucketStart / 1_000_000 + pm.peakPromptTokens);
  const nCompletion = 0.75 + 0.50 * noise(bucketStart / 1_000_001 + pm.completionRatio * 1000);

  const promptTokens     = Math.round(pm.peakPromptTokens * activity * stepScale * nPrompt);
  const completionTokens = Math.round(promptTokens * pm.completionRatio * nCompletion);
  const totalTokens      = promptTokens + completionTokens;

  return { completionTokens, promptTokens, totalTokens };
};

// ---------------------------------------------------------------------------
// Builder  –  windowSecs and stepSecs are plain integers (seconds)
//             Uses the current wall-clock time as the end of the window.
// ---------------------------------------------------------------------------

export const buildStatsResponse = (windowSecs = 86_400, stepSecs = 3_600): AIUsageResponse => {
  const now        = Date.now();
  const startMs    = now - windowSecs * 1_000;
  const numBuckets = Math.ceil(windowSecs / stepSecs);

  // ── Build per-(provider, model) time-series buckets ──────────────────────
  const series: AITimeSeriesEntry[] = PROVIDER_MODELS.map(pm => {
    const points: AITimeSeriesPoint[] = Array.from({ length: numBuckets }, (_, i) => {
      const bucketStart = startMs + i * stepSecs * 1_000;
      const { completionTokens, promptTokens, totalTokens } = generateBucket(bucketStart, stepSecs, pm);
      return {
        completionTokens,
        promptTokens,
        timestamp: new Date(bucketStart).toISOString(),
        totalTokens,
      };
    });
    return { model: pm.model, points, provider: pm.provider };
  });

  // ── summary.byProvider — sum all buckets across every model ──────────────
  const providerMap = new Map<string, AITokenRow>();
  series.forEach(s => {
    const row = providerMap.get(s.provider) ?? { provider: s.provider, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    s.points.forEach(p => {
      row.promptTokens     += p.promptTokens;
      row.completionTokens += p.completionTokens;
      row.totalTokens      += p.totalTokens;
    });
    providerMap.set(s.provider, row);
  });

  // ── summary.byModel — sum all buckets per model ───────────────────────────
  const modelMap = new Map<string, AITokenRow>();
  series.forEach(s => {
    const key = `${s.provider}::${s.model}`;
    const row = modelMap.get(key) ?? { provider: s.provider, model: s.model, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    s.points.forEach(p => {
      row.promptTokens     += p.promptTokens;
      row.completionTokens += p.completionTokens;
      row.totalTokens      += p.totalTokens;
    });
    modelMap.set(key, row);
  });

  return {
    summary: {
      byProvider: [...providerMap.values()].sort((a, b) => (a.provider ?? '').localeCompare(b.provider ?? '')),
      byModel: [...modelMap.values()].sort((a, b) =>
        `${a.provider ?? ''}${a.model ?? ''}`.localeCompare(`${b.provider ?? ''}${b.model ?? ''}`)
      ),
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
    const stepSecs   = Number(url.searchParams.get('step'))   || 3600; // 1 hour
    return HttpResponse.json(buildStatsResponse(windowSecs, stepSecs));
  }),

  // GET /api/chat/session/usage
  http.get('*/api/chat/session/usage', () => {
    return HttpResponse.json(buildSessionStats());
  }),
];
