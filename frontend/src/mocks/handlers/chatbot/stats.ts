import { http, HttpResponse } from 'msw';
import {
  AITimeSeriesEntry,
  AITimeSeriesPoint,
  AITokenRow,
  AIUsageResponse,
  ChatSessionUsageMetric
} from '../../../types/Chatbot';

// ---------------------------------------------------------------------------
// Base date: 2026-06-17T00:00:00Z  (24 hourly points → index 0 = midnight)
// ---------------------------------------------------------------------------
const BASE_DATE = '2026-06-17T';
const ts = (hour: number): string => `${BASE_DATE}${String(hour).padStart(2, '0')}:00:00Z`;

// ---------------------------------------------------------------------------
// Full dataset: one entry per (provider, model, hour)
// Token volumes reflect realistic business-hours usage patterns.
// ---------------------------------------------------------------------------
interface RawPoint {
  completionTokens: number;
  hour: number;
  model: string;
  promptTokens: number;
  provider: string;
}

const RAW_POINTS: RawPoint[] = [
  // ── openai / gpt-4o  (heavy daytime usage) ────────────────────────────────
  { provider: 'openai', model: 'gpt-4o', hour: 0,  promptTokens:  80, completionTokens:  30 },
  { provider: 'openai', model: 'gpt-4o', hour: 1,  promptTokens:  50, completionTokens:  20 },
  { provider: 'openai', model: 'gpt-4o', hour: 2,  promptTokens:  40, completionTokens:  15 },
  { provider: 'openai', model: 'gpt-4o', hour: 3,  promptTokens:  35, completionTokens:  12 },
  { provider: 'openai', model: 'gpt-4o', hour: 4,  promptTokens:  30, completionTokens:  10 },
  { provider: 'openai', model: 'gpt-4o', hour: 5,  promptTokens:  45, completionTokens:  18 },
  { provider: 'openai', model: 'gpt-4o', hour: 6,  promptTokens: 120, completionTokens:  50 },
  { provider: 'openai', model: 'gpt-4o', hour: 7,  promptTokens: 310, completionTokens: 130 },
  { provider: 'openai', model: 'gpt-4o', hour: 8,  promptTokens: 620, completionTokens: 260 },
  { provider: 'openai', model: 'gpt-4o', hour: 9,  promptTokens: 980, completionTokens: 410 },
  { provider: 'openai', model: 'gpt-4o', hour: 10, promptTokens:1240, completionTokens: 520 },
  { provider: 'openai', model: 'gpt-4o', hour: 11, promptTokens:1380, completionTokens: 580 },
  { provider: 'openai', model: 'gpt-4o', hour: 12, promptTokens: 900, completionTokens: 380 },
  { provider: 'openai', model: 'gpt-4o', hour: 13, promptTokens:1050, completionTokens: 440 },
  { provider: 'openai', model: 'gpt-4o', hour: 14, promptTokens:1320, completionTokens: 550 },
  { provider: 'openai', model: 'gpt-4o', hour: 15, promptTokens:1410, completionTokens: 590 },
  { provider: 'openai', model: 'gpt-4o', hour: 16, promptTokens:1180, completionTokens: 495 },
  { provider: 'openai', model: 'gpt-4o', hour: 17, promptTokens: 760, completionTokens: 320 },
  { provider: 'openai', model: 'gpt-4o', hour: 18, promptTokens: 440, completionTokens: 185 },
  { provider: 'openai', model: 'gpt-4o', hour: 19, promptTokens: 310, completionTokens: 130 },
  { provider: 'openai', model: 'gpt-4o', hour: 20, promptTokens: 220, completionTokens:  92 },
  { provider: 'openai', model: 'gpt-4o', hour: 21, promptTokens: 170, completionTokens:  70 },
  { provider: 'openai', model: 'gpt-4o', hour: 22, promptTokens: 130, completionTokens:  54 },
  { provider: 'openai', model: 'gpt-4o', hour: 23, promptTokens: 100, completionTokens:  42 },

  // ── openai / gpt-4o-mini  (lighter, cost-optimised tasks) ─────────────────
  { provider: 'openai', model: 'gpt-4o-mini', hour: 0,  promptTokens: 200, completionTokens:  80 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 1,  promptTokens: 140, completionTokens:  55 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 2,  promptTokens: 110, completionTokens:  44 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 3,  promptTokens:  90, completionTokens:  36 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 4,  promptTokens:  80, completionTokens:  32 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 5,  promptTokens: 120, completionTokens:  48 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 6,  promptTokens: 280, completionTokens: 112 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 7,  promptTokens: 510, completionTokens: 204 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 8,  promptTokens: 780, completionTokens: 312 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 9,  promptTokens: 940, completionTokens: 376 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 10, promptTokens:1100, completionTokens: 440 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 11, promptTokens:1200, completionTokens: 480 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 12, promptTokens: 820, completionTokens: 328 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 13, promptTokens: 960, completionTokens: 384 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 14, promptTokens:1150, completionTokens: 460 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 15, promptTokens:1220, completionTokens: 488 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 16, promptTokens:1030, completionTokens: 412 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 17, promptTokens: 680, completionTokens: 272 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 18, promptTokens: 400, completionTokens: 160 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 19, promptTokens: 280, completionTokens: 112 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 20, promptTokens: 210, completionTokens:  84 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 21, promptTokens: 160, completionTokens:  64 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 22, promptTokens: 130, completionTokens:  52 },
  { provider: 'openai', model: 'gpt-4o-mini', hour: 23, promptTokens: 110, completionTokens:  44 },

  // ── anthropic / claude-3-5-sonnet  (medium usage) ─────────────────────────
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 0,  promptTokens:  60, completionTokens:  25 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 1,  promptTokens:  40, completionTokens:  17 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 2,  promptTokens:  30, completionTokens:  12 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 3,  promptTokens:  25, completionTokens:  10 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 4,  promptTokens:  22, completionTokens:   9 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 5,  promptTokens:  35, completionTokens:  14 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 6,  promptTokens:  90, completionTokens:  38 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 7,  promptTokens: 240, completionTokens: 100 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 8,  promptTokens: 480, completionTokens: 200 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 9,  promptTokens: 720, completionTokens: 300 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 10, promptTokens: 860, completionTokens: 358 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 11, promptTokens: 940, completionTokens: 392 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 12, promptTokens: 630, completionTokens: 262 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 13, promptTokens: 730, completionTokens: 304 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 14, promptTokens: 900, completionTokens: 375 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 15, promptTokens: 960, completionTokens: 400 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 16, promptTokens: 810, completionTokens: 337 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 17, promptTokens: 530, completionTokens: 220 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 18, promptTokens: 310, completionTokens: 129 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 19, promptTokens: 210, completionTokens:  87 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 20, promptTokens: 150, completionTokens:  62 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 21, promptTokens: 110, completionTokens:  46 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 22, promptTokens:  80, completionTokens:  33 },
  { provider: 'anthropic', model: 'claude-3-5-sonnet', hour: 23, promptTokens:  65, completionTokens:  27 },

  // ── anthropic / claude-3-haiku  (fast & cheap, used for quick lookups) ────
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 0,  promptTokens: 300, completionTokens: 120 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 1,  promptTokens: 210, completionTokens:  84 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 2,  promptTokens: 160, completionTokens:  64 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 3,  promptTokens: 130, completionTokens:  52 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 4,  promptTokens: 110, completionTokens:  44 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 5,  promptTokens: 170, completionTokens:  68 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 6,  promptTokens: 350, completionTokens: 140 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 7,  promptTokens: 620, completionTokens: 248 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 8,  promptTokens: 870, completionTokens: 348 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 9,  promptTokens:1020, completionTokens: 408 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 10, promptTokens:1150, completionTokens: 460 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 11, promptTokens:1230, completionTokens: 492 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 12, promptTokens: 840, completionTokens: 336 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 13, promptTokens: 970, completionTokens: 388 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 14, promptTokens:1140, completionTokens: 456 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 15, promptTokens:1190, completionTokens: 476 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 16, promptTokens:1010, completionTokens: 404 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 17, promptTokens: 660, completionTokens: 264 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 18, promptTokens: 390, completionTokens: 156 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 19, promptTokens: 270, completionTokens: 108 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 20, promptTokens: 200, completionTokens:  80 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 21, promptTokens: 155, completionTokens:  62 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 22, promptTokens: 125, completionTokens:  50 },
  { provider: 'anthropic', model: 'claude-3-haiku', hour: 23, promptTokens: 100, completionTokens:  40 },

  // ── lightspeed / granite-3-8b  (on-prem / air-gap, steady low volume) ─────
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 0,  promptTokens: 140, completionTokens:  56 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 1,  promptTokens: 100, completionTokens:  40 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 2,  promptTokens:  80, completionTokens:  32 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 3,  promptTokens:  65, completionTokens:  26 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 4,  promptTokens:  55, completionTokens:  22 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 5,  promptTokens:  80, completionTokens:  32 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 6,  promptTokens: 160, completionTokens:  64 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 7,  promptTokens: 280, completionTokens: 112 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 8,  promptTokens: 410, completionTokens: 164 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 9,  promptTokens: 520, completionTokens: 208 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 10, promptTokens: 590, completionTokens: 236 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 11, promptTokens: 630, completionTokens: 252 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 12, promptTokens: 430, completionTokens: 172 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 13, promptTokens: 490, completionTokens: 196 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 14, promptTokens: 570, completionTokens: 228 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 15, promptTokens: 610, completionTokens: 244 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 16, promptTokens: 520, completionTokens: 208 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 17, promptTokens: 340, completionTokens: 136 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 18, promptTokens: 200, completionTokens:  80 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 19, promptTokens: 140, completionTokens:  56 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 20, promptTokens: 105, completionTokens:  42 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 21, promptTokens:  80, completionTokens:  32 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 22, promptTokens:  65, completionTokens:  26 },
  { provider: 'lightspeed', model: 'granite-3-8b', hour: 23, promptTokens:  55, completionTokens:  22 },
];

// ---------------------------------------------------------------------------
// Builder  –  windowSecs and stepSecs are plain integers (seconds)
// ---------------------------------------------------------------------------

export const buildStatsResponse = (windowSecs = 86400, stepSecs = 3600): AIUsageResponse => {
  const windowHours = windowSecs / 3600;
  const stepHours   = stepSecs   / 3600;
  const numBuckets  = Math.ceil(windowHours / stepHours);

  // Only keep raw points that fall within the requested window.
  const filtered = RAW_POINTS.filter(p => p.hour < windowHours);

  // ── summary.byProvider ──────────────────────────────────────────────────
  const providerMap = new Map<string, AITokenRow>();
  filtered.forEach(p => {
    const existing = providerMap.get(p.provider) ?? { provider: p.provider, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    existing.promptTokens += p.promptTokens;
    existing.completionTokens += p.completionTokens;
    existing.totalTokens += p.promptTokens + p.completionTokens;
    providerMap.set(p.provider, existing);
  });

  // ── summary.byModel ──────────────────────────────────────────────────────
  const modelMap = new Map<string, AITokenRow>();
  filtered.forEach(p => {
    const key = `${p.provider}::${p.model}`;
    const existing = modelMap.get(key) ?? { provider: p.provider, model: p.model, promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    existing.promptTokens += p.promptTokens;
    existing.completionTokens += p.completionTokens;
    existing.totalTokens += p.promptTokens + p.completionTokens;
    modelMap.set(key, existing);
  });

  // ── timeSeries ────────────────────────────────────────────────────────────
  // Group by (provider, model), then bucket by step.
  const seriesMap = new Map<string, { provider: string; model: string; buckets: AITimeSeriesPoint[] }>();

  filtered.forEach(p => {
    const seriesKey = `${p.provider}::${p.model}`;
    if (!seriesMap.has(seriesKey)) {
      const points: AITimeSeriesPoint[] = Array.from({ length: numBuckets }, (_, i) => ({
        timestamp: ts(Math.floor(i * stepHours)),
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
      }));
      seriesMap.set(seriesKey, { provider: p.provider, model: p.model, buckets: points });
    }
    const bucketIndex = Math.min(Math.floor(p.hour / stepHours), numBuckets - 1);
    const bucket = seriesMap.get(seriesKey)!.buckets[bucketIndex];
    bucket.promptTokens += p.promptTokens;
    bucket.completionTokens += p.completionTokens;
    bucket.totalTokens += p.promptTokens + p.completionTokens;
  });

  const series: AITimeSeriesEntry[] = [...seriesMap.values()]
    .sort((a, b) => a.provider.localeCompare(b.provider) || a.model.localeCompare(b.model))
    .map(({ provider, model, buckets }) => ({ provider, model, points: buckets }));

  return {
    summary: {
      byProvider: [...providerMap.values()].sort((a, b) => (a.provider ?? '').localeCompare(b.provider ?? '')),
      byModel: [...modelMap.values()].sort((a, b) =>
        `${a.provider}${a.model}`.localeCompare(`${b.provider}${b.model}`)
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
    const windowSecs = Number(url.searchParams.get('window')) || 86400;
    const stepSecs   = Number(url.searchParams.get('step'))   || 3600;
    return HttpResponse.json(buildStatsResponse(windowSecs, stepSecs));
  }),

  // GET /api/chat/session/usage
  http.get('*/api/chat/session/usage', () => {
    return HttpResponse.json(buildSessionStats());
  }),
];
