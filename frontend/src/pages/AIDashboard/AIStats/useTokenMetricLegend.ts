import * as React from 'react';
import { TokenMetric } from 'types/Chatbot';
import { DurationInSeconds } from 'types/Common';
import { TOKEN_METRIC_COLORS } from './colorPalette';
import { LegendClickEvent, LegendItem } from './useProviderLegend';

const DIM_FILL = '#D2D2D2';
const DIM_LABEL = '#A8A8A8';
const LIVE_LABEL = '#151515';

const TOKEN_METRIC_OPTIONS: Array<{ label: string; value: TokenMetric }> = [
  { value: 'totalTokens', label: 'Total Tokens' },
  { value: 'promptTokens', label: 'Prompt Tokens' },
  { value: 'completionTokens', label: 'Completion Tokens' }
];

/**
 * Radio-button legend for the three token metric types.
 *
 * Interaction rules:
 *  - Always exactly one item is active (single-select / radio behaviour).
 *  - Clicking an already-active item is a no-op.
 *  - Clicking an inactive item makes it active and calls onFilterChange.
 *  - Colours are fixed via TOKEN_METRIC_COLORS (independent of provider palette).
 */
export const useTokenMetricLegend = (
  tokenMetric: TokenMetric,
  provider: string,
  duration: DurationInSeconds,
  step: DurationInSeconds,
  onFilterChange: (
    provider: string,
    tokenMetric: TokenMetric,
    duration: DurationInSeconds,
    step: DurationInSeconds
  ) => void
): {
  clickEvents: LegendClickEvent[];
  legendData: LegendItem[];
  tokenMetricOptions: typeof TOKEN_METRIC_OPTIONS;
} => {
  const legendData: LegendItem[] = React.useMemo(
    () =>
      TOKEN_METRIC_OPTIONS.map(opt => {
        const active = tokenMetric === opt.value;
        return {
          name: opt.label,
          symbol: {
            fill: active ? TOKEN_METRIC_COLORS[opt.value] : DIM_FILL,
            opacity: active ? 1 : 0.4
          },
          labels: { fill: active ? LIVE_LABEL : DIM_LABEL }
        };
      }),
    [tokenMetric]
  );

  const handleClick = React.useCallback(
    (clickedLabel: string) => {
      const opt = TOKEN_METRIC_OPTIONS.find(o => o.label === clickedLabel);
      if (!opt || opt.value === tokenMetric) return; // no-op if already active
      onFilterChange(provider, opt.value, duration, step);
    },
    [tokenMetric, provider, duration, step, onFilterChange]
  );

  const clickEvents: LegendClickEvent[] = React.useMemo(() => {
    const handler = (_: unknown, props: { datum: { name: string } }) => {
      handleClick(props.datum.name);
      return null;
    };
    return [
      { target: 'data', eventHandlers: { onClick: handler } },
      { target: 'labels', eventHandlers: { onClick: handler } }
    ];
  }, [handleClick]);

  return { clickEvents, legendData, tokenMetricOptions: TOKEN_METRIC_OPTIONS };
};
