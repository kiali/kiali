/**
 * Provider/model colour palette for the AI Dashboard charts.
 *
 * Each provider is assigned one of the PROVIDER_PALETTES in order of its
 * position in the providers list.  The first shade is the "main" colour used
 * for the provider itself; subsequent shades are used for individual models
 * belonging to that provider, from light → dark.
 */

export interface ColorPalette {
  main: string;
  /** Ordered shades used for individual models (lightest → darkest). */
  shades: string[];
}

export const PROVIDER_PALETTES: ColorPalette[] = [
  // Blue  — index 0
  { main: '#0066CC', shades: ['#BEE1F4', '#73BCF7', '#2B9AF3', '#0066CC', '#004080', '#002952'] },
  // Red   — index 1
  { main: '#C9190B', shades: ['#FFD2CC', '#F5ABAB', '#E37176', '#C9190B', '#A30000', '#7D1007'] },
  // Green — index 2
  { main: '#3E8635', shades: ['#BDE5B8', '#7CC674', '#6EC664', '#3E8635', '#23511E', '#1D4115'] },
  // Gold  — index 3
  { main: '#F0AB00', shades: ['#FAE7B5', '#F9E0A2', '#F4C145', '#F0AB00', '#C46100', '#8F4700'] },
  // Purple — index 4
  { main: '#8481DD', shades: ['#E7E5F8', '#D2D1F5', '#B2AFEC', '#8481DD', '#5752D1', '#3C3D99'] },
  // Orange — index 5
  { main: '#EC7A08', shades: ['#FBDAB7', '#F8C186', '#F4B678', '#EC7A08', '#C46100', '#8F4700'] },
  // Teal  — index 6
  { main: '#009596', shades: ['#A2D9D9', '#73C5C5', '#4CB1B1', '#009596', '#006E6F', '#003737'] }
];

/**
 * Neutral colour shown for the 'All' legend control (not a data series).
 * It intentionally has no palette entry because 'All' does not appear in
 * charts as a data series.
 */
export const ALL_ITEM_COLOR = '#6A6E73';

/**
 * Fixed colours for the three token-metric legend items.
 * Deliberately different from the provider palettes above.
 */
export const TOKEN_METRIC_COLORS: Record<string, string> = {
  totalTokens: '#0E6193', // slate blue
  promptTokens: '#C85C19', // burnt orange
  completionTokens: '#2E7D32' // forest green
};

// ── Lookup helpers ────────────────────────────────────────────────────────────

/**
 * Returns the palette assigned to a provider.
 * Assignment is based on the provider's index in `specificProviders`
 * (= providersOptions without 'All'), so colours are stable across renders
 * as long as the list order stays the same.
 */
export const getProviderPalette = (specificProviders: string[], provider: string): ColorPalette => {
  const idx = specificProviders.indexOf(provider);
  return PROVIDER_PALETTES[Math.max(0, idx) % PROVIDER_PALETTES.length];
};

/** Main colour for a provider (used in legends and single-provider charts). */
export const getProviderColor = (specificProviders: string[], provider: string): string =>
  getProviderPalette(specificProviders, provider).main;

/**
 * Shade colour for a model within a provider.
 * @param modelShadeIndex  0-based index of the model within this provider's models.
 */
export const getModelColor = (specificProviders: string[], provider: string, modelShadeIndex: number): string => {
  const palette = getProviderPalette(specificProviders, provider);
  return palette.shades[modelShadeIndex % palette.shades.length];
};

/**
 * Builds a colour scale array aligned with `rows`, where each row has
 * a `provider` and optionally a `model`.  When `byModel` is true the colours
 * cycle through shades; otherwise the main provider colour is used.
 */
export const buildColorScale = (
  specificProviders: string[],
  rows: Array<{ model?: string; provider?: string }>,
  byModel: boolean
): string[] => {
  if (!byModel) {
    return rows.map(r => getProviderColor(specificProviders, r.provider ?? ''));
  }
  // Track how many models we've seen per provider to pick the next shade.
  const providerShadeIdx = new Map<string, number>();
  return rows.map(r => {
    const p = r.provider ?? '';
    const idx = providerShadeIdx.get(p) ?? 0;
    providerShadeIdx.set(p, idx + 1);
    return getModelColor(specificProviders, p, idx);
  });
};
