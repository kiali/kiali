import * as React from 'react';
import { ALL_ITEM_COLOR, getProviderColor } from './colorPalette';

export interface LegendItem {
  labels: { fill: string };
  name: string;
  symbol: { fill: string; opacity: number };
}

export interface LegendClickEvent {
  eventHandlers: {
    onClick: (_: unknown, props: { datum: { name: string } }) => null;
  };
  target: 'data' | 'labels';
}

const DIM_FILL = '#D2D2D2';
const DIM_LABEL = '#A8A8A8';
const LIVE_LABEL = '#151515';

/**
 * Manages provider multi-selection state for the VictoryLegend.
 *
 * Interaction rules:
 *  - Initial state: empty selection → only 'All' is lit, all specific providers dimmed.
 *  - Click a specific provider → toggle it; multiple providers can be active at once.
 *    'All' dims as soon as any specific provider is selected.
 *  - Click 'All' → clears the selection and returns to the initial 'All' state.
 *  - Resets automatically when `providersOptions` changes (new data load).
 *
 * Returns:
 *  - `legendData`   — data prop for VictoryLegend (symbols + label styles)
 *  - `clickEvents`  — events prop for VictoryLegend (data + labels targets)
 */
import { TokenMetric } from 'types/Chatbot';
import { DurationInSeconds } from 'types/Common';

export const useProviderLegend = (
  providersOptions: string[],
  tokenMetric: TokenMetric,
  duration: DurationInSeconds,
  step: DurationInSeconds,
  onFilterChange: (
    provider: string,
    tokenMetric: TokenMetric,
    duration: DurationInSeconds,
    step: DurationInSeconds
  ) => void
): { clickEvents: LegendClickEvent[]; legendData: LegendItem[] } => {
  // Empty set = "All" mode; non-empty = specific providers selected.
  const [activeProviders, setActiveProviders] = React.useState<Set<string>>(new Set());

  // Clear selection whenever the provider list changes.
  React.useEffect(() => {
    setActiveProviders(new Set());
  }, [providersOptions]);

  const handleClick = React.useCallback(
    (clickedName: string) => {
      setActiveProviders(prev => {
        const next = new Set(prev);

        if (clickedName === 'All') {
          onFilterChange('All', tokenMetric, duration, step);
          return new Set();
        }

        if (next.has(clickedName)) {
          next.delete(clickedName);
        } else {
          next.add(clickedName);
        }

        // If every specific provider is now selected, that is identical to 'All' →
        // reset to All mode so the user gets a clean state.
        const specificProviders = providersOptions.filter(p => p !== 'All');
        const allSelected = specificProviders.length > 0 && specificProviders.every(p => next.has(p));

        if (next.size === 0 || allSelected) {
          onFilterChange('All', tokenMetric, duration, step);
          return new Set();
        }

        onFilterChange(Array.from(next).join(','), tokenMetric, duration, step);
        return next;
      });
    },
    [onFilterChange, tokenMetric, duration, step, providersOptions]
  );

  const legendData: LegendItem[] = React.useMemo(() => {
    const allMode = activeProviders.size === 0;
    const specificProviders = providersOptions.filter(p => p !== 'All');
    return providersOptions.map(p => {
      const active = allMode ? p === 'All' : activeProviders.has(p);
      // 'All' uses a neutral indicator colour; specific providers use their palette main colour.
      const activeColor = p === 'All' ? ALL_ITEM_COLOR : getProviderColor(specificProviders, p);
      return {
        name: p,
        symbol: {
          fill: active ? activeColor : DIM_FILL,
          opacity: active ? 1 : 0.4
        },
        labels: { fill: active ? LIVE_LABEL : DIM_LABEL }
      };
    });
  }, [providersOptions, activeProviders]);

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

  return { clickEvents, legendData };
};
