import * as React from 'react';
import { Gallery, GalleryItem } from '@patternfly/react-core';
import { AIUsageResponse, TokenMetric, UsageValueKind } from 'types/Chatbot';
import { AIKPICard } from './AIKPICard';
import { CubeIcon, ResourcesFullIcon } from '@patternfly/react-icons';
import { ALL_ITEM_COLOR, getProviderColor } from './colorPalette';
import { style } from 'typestyle';

interface AIKPIProps {
  metric: TokenMetric;
  onProviderChange: (provider: string) => void;
  /** When showing cost, also render the token total in a smaller size. */
  showTokens?: boolean;
  summary: AIUsageResponse['summary'];
  valueKind?: UsageValueKind;
}

/**
 * Gallery of KPI cards — one per provider + a synthetic "total" card.
 *
 * Selection rules (same as useProviderLegend):
 *  - Initial: empty set → only "total" card active (= 'All' mode).
 *  - Click a specific provider → toggle it; "total" dims.
 *  - All specific providers selected → reset to 'All' mode.
 *  - Deselect last provider → reset to 'All' mode.
 *  - Click "total" → reset to 'All' mode.
 */
export const AIKPI: React.FC<AIKPIProps> = ({
  metric,
  onProviderChange,
  showTokens = false,
  summary,
  valueKind = 'tokens'
}) => {
  const [activeProviders, setActiveProviders] = React.useState<Set<string>>(new Set());

  // Reset when the provider list changes (new data load).
  const providerList = summary.byProvider.map(p => p.provider ?? '');
  React.useEffect(() => {
    setActiveProviders(new Set());
  }, [providerList.join(',')]);

  // Providers that are actual data providers (not the synthetic 'total').
  const specificProviders = summary.byProvider.map(p => p.provider ?? '').filter(p => p !== 'total');

  const handleClick = (clickedProvider: string) => {
    setActiveProviders(prev => {
      const next = new Set(prev);

      if (clickedProvider === 'total') {
        onProviderChange('All');
        return new Set();
      }

      if (next.has(clickedProvider)) {
        next.delete(clickedProvider);
      } else {
        next.add(clickedProvider);
      }

      const allSelected = specificProviders.length > 0 && specificProviders.every(p => next.has(p));

      if (next.size === 0 || allSelected) {
        onProviderChange('All');
        return new Set();
      }

      onProviderChange(Array.from(next).join(','));
      return next;
    });
  };

  const isActive = (provider: string): boolean =>
    provider === 'total' ? activeProviders.size === 0 : activeProviders.has(provider);

  const totalEntry = summary.byProvider.find(p => p.provider === 'total');

  return (
    <Gallery hasGutter>
      {/* Total card */}
      {totalEntry && (
        <GalleryItem>
          <AIKPICard
            color={ALL_ITEM_COLOR}
            icon={<CubeIcon className={style({ color: ALL_ITEM_COLOR })} />}
            id="kpi-total"
            isActive={isActive('total')}
            metric={metric}
            onClick={() => handleClick('total')}
            showTokens={showTokens}
            summary={totalEntry}
            title="Total"
            valueKind={valueKind}
          />
        </GalleryItem>
      )}

      {/* Per-provider cards */}
      {summary.byProvider
        .filter(p => p.provider !== 'total')
        .map(provider => {
          const providerName = provider.provider ?? '';
          const color = getProviderColor(specificProviders, providerName);
          return (
            <GalleryItem key={providerName}>
              <AIKPICard
                color={color}
                icon={<ResourcesFullIcon className={style({ color: color })} />}
                id={`kpi-${providerName}`}
                isActive={isActive(providerName)}
                metric={metric}
                onClick={() => handleClick(providerName)}
                showTokens={showTokens}
                summary={provider}
                title={providerName.charAt(0).toUpperCase() + providerName.slice(1)}
                valueKind={valueKind}
              />
            </GalleryItem>
          );
        })}
    </Gallery>
  );
};
