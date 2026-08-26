import {
  Grid,
  GridItem,
  Toolbar,
  ToolbarContent,
  ToolbarItem,
  Title,
  TitleSizes,
  ToolbarGroup
} from '@patternfly/react-core';

import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { useKialiTranslation } from 'utils/I18nUtils';

const ALL_DURATION_OPTIONS: { label: string; value: number }[] = [
  { value: 300, label: 'Last 5m' },
  { value: 900, label: 'Last 15m' },
  { value: 1800, label: 'Last 30m' },
  { value: 3600, label: 'Last 1h' },
  { value: 10800, label: 'Last 3h' },
  { value: 21600, label: 'Last 6h' },
  { value: 43200, label: 'Last 12h' },
  { value: 86400, label: 'Last 1d' },
  { value: 604800, label: 'Last 7d' },
  { value: 2592000, label: 'Last 30d' }
];

const DURATION_OPTIONS_MAP: { [k: string]: string } = Object.fromEntries(
  ALL_DURATION_OPTIONS.map(o => [String(o.value), o.label])
);

// All candidate step sizes, from finest to coarsest.
const ALL_STEP_OPTIONS: { label: string; value: number }[] = [
  { value: 60, label: '1m' },
  { value: 120, label: '2m' },
  { value: 300, label: '5m' },
  { value: 600, label: '10m' },
  { value: 900, label: '15m' },
  { value: 1800, label: '30m' },
  { value: 3600, label: '1h' },
  { value: 7200, label: '2h' },
  { value: 10800, label: '3h' },
  { value: 21600, label: '6h' },
  { value: 43200, label: '12h' },
  { value: 86400, label: '1d' }
];

/**
 * Returns the smallest step that yields at most 20 data points for the given
 * window. Used as the automatic default when the user changes the time range.
 */
export const getDefaultStep = (windowSecs: number): number => {
  const minStepSecs = windowSecs / 20;
  const match = ALL_STEP_OPTIONS.find(o => o.value >= minStepSecs);
  return match?.value ?? ALL_STEP_OPTIONS[ALL_STEP_OPTIONS.length - 1].value;
};

const metricOptions: { label: string; value: string }[] = [
  { value: 'totalTokens', label: 'Total Tokens' },
  { value: 'promptTokens', label: 'Prompt Tokens' },
  { value: 'completionTokens', label: 'Completion Tokens' }
];

const METRIC_OPTIONS_MAP: { [k: string]: string } = Object.fromEntries(metricOptions.map(o => [o.value, o.label]));

export const AIStatsHeader: React.FC<{
  window: number;
  onWindowChange: (window: number, step: number) => void;
  metric: string;
  onMetricChange: (metric: string) => void;
}> = ({ window, onWindowChange, metric, onMetricChange }) => {
  const { t } = useKialiTranslation();
  return (
    <Grid>
      <GridItem span={9}>
        <Title headingLevel="h1" size={TitleSizes['4xl']}>
          {' '}
          Consumption of LLM
        </Title>
      </GridItem>
      <GridItem span={3}>
        <Toolbar id="ai-stats-header-toolbar-group">
          <ToolbarContent>
            <ToolbarGroup align={{ default: 'alignEnd' }}>
              <ToolbarItem>
                <ToolbarDropdown
                  id="ai-stats-duration-dd"
                  handleSelect={value => {
                    const newDuration = Number(value);
                    const newStep = getDefaultStep(newDuration);
                    onWindowChange(newDuration, newStep);
                  }}
                  value={window}
                  label={ALL_DURATION_OPTIONS.find(o => o.value === window)?.label ?? String(window)}
                  options={DURATION_OPTIONS_MAP}
                  tooltip={t('Metric time period')}
                />
              </ToolbarItem>
              <ToolbarItem variant="separator" />
              <ToolbarItem>
                <ToolbarDropdown
                  id="ai-stats-metric-dropdown"
                  handleSelect={value => onMetricChange(value as string)}
                  value={metric}
                  label={metricOptions.find(o => o.value === metric)?.label ?? String(metric)}
                  options={METRIC_OPTIONS_MAP}
                />
              </ToolbarItem>
            </ToolbarGroup>
          </ToolbarContent>
        </Toolbar>
      </GridItem>
    </Grid>
  );
};
