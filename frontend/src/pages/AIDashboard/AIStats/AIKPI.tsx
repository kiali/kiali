import * as React from 'react';
import { Gallery, GalleryItem } from '@patternfly/react-core';
import { AIUsageResponse, TokenMetric } from 'types/Chatbot';
import { AIKPICard } from './AIKPICard';
import { CubeIcon, ResourcesFullIcon } from '@patternfly/react-icons';
import { ALL_ITEM_COLOR, getProviderColor } from './colorPalette';
import { style } from 'typestyle';

interface AIKPIProps {
  onProviderChange: (provider: string) => void;
  summary: AIUsageResponse['summary'];
  metric: TokenMetric;
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
export const AIKPI: React.FC<AIKPIProps> = ({ onProviderChange, summary, metric }) => {
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
            id="kpi-total"
            title="Total"
            icon={<CubeIcon className={style({ color: ALL_ITEM_COLOR })} />}
            color={ALL_ITEM_COLOR}
            summary={totalEntry}
            isActive={isActive('total')}
            onClick={() => handleClick('total')}
            metric={metric}
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
                id={`kpi-${providerName}`}
                title={providerName.charAt(0).toUpperCase() + providerName.slice(1)}
                icon={<ResourcesFullIcon className={style({ color: color })} />}
                color={color}
                summary={provider}
                isActive={isActive(providerName)}
                onClick={() => handleClick(providerName)}
                metric={metric}
              />
            </GalleryItem>
          );
        })}
    </Gallery>
  );
};
