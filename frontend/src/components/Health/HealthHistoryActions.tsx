// Assisted-by: OpenAI Codex
import * as React from 'react';
import { Button, FormGroup, FormSelect, FormSelectOption, Popover, Stack, StackItem } from '@patternfly/react-core';
import { KialiLink } from 'components/Link/KialiLink';
import { CustomTimeTabsContext } from 'components/Tab/CustomTimeTabs';
import { useKialiSelector } from 'hooks/redux';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { useKialiTranslation } from 'utils/I18nUtils';
import type { HealthHistoryType } from 'services/Api';
import { getHealthHistoryGraphUrl, getHealthHistoryRange } from './HealthHistoryNavigation';

type HealthHistoryActionsProps = {
  children: (onSelect: (timestamp: number, position: number) => void) => React.ReactElement;
  cluster?: string;
  healthType: HealthHistoryType;
  name: string;
  namespace: string;
};

const containerStyle = kialiStyle({
  position: 'relative'
});

const anchorStyle = kialiStyle({
  height: '0.625rem',
  pointerEvents: 'none',
  position: 'absolute',
  top: 0,
  width: 0
});

const actionsStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: PFSpacer.sm
});

export const HealthHistoryActions: React.FC<HealthHistoryActionsProps> = props => {
  const { t } = useKialiTranslation();
  const { onSelect, tabs } = React.useContext(CustomTimeTabsContext);
  const graphDuration = useKialiSelector(state => state.userSettings.duration);
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [selection, setSelection] = React.useState<{ now: number; position: number; timestamp: number }>();
  const [duration, setDuration] = React.useState(600);
  const range = selection ? getHealthHistoryRange(selection.timestamp, duration, selection.now) : undefined;
  const formatTime = (timestamp: number): string => new Date(timestamp).toLocaleString();
  const options: Record<string, string> = {
    60: t('1 minute'),
    300: t('5 minutes'),
    600: t('10 minutes'),
    1800: t('30 minutes')
  };

  const handleSelect = React.useCallback((timestamp: number, position: number): void => {
    setSelection({ now: Date.now(), position, timestamp });
  }, []);

  return (
    <div className={containerStyle}>
      <span
        ref={anchorRef}
        aria-hidden="true"
        className={anchorStyle}
        data-test="health-history-popover-anchor"
        style={{ left: `${(selection?.position ?? 0.5) * 100}%` }}
      />
      <Popover
        triggerRef={anchorRef}
        headerContent={t('Troubleshoot health')}
        position="top"
        isVisible={selection !== undefined}
        shouldClose={() => setSelection(undefined)}
        bodyContent={
          range && selection ? (
            <Stack hasGutter data-test="health-history-actions">
              <StackItem>
                {t('Selected time')}: {formatTime(selection.timestamp * 1000)}
              </StackItem>
              <StackItem>
                <FormGroup label={t('Troubleshooting window')} fieldId="health-history-window">
                  <FormSelect
                    id="health-history-window"
                    aria-label={t('Troubleshooting window')}
                    value={duration}
                    onChange={(_event, value) => setDuration(Number(value))}
                    data-test="health-history-window"
                  >
                    {Object.entries(options).map(([seconds, label]) => (
                      <FormSelectOption key={seconds} value={seconds} label={label} />
                    ))}
                  </FormSelect>
                </FormGroup>
              </StackItem>
              <StackItem data-test="health-history-investigation-range">
                {formatTime(range.from)} – {formatTime(range.to)}
              </StackItem>
              <StackItem className={actionsStyle}>
                <KialiLink
                  dataTest="health-history-replay"
                  to={getHealthHistoryGraphUrl(
                    props.healthType,
                    props.namespace,
                    props.name,
                    props.cluster,
                    range,
                    graphDuration
                  )}
                  onClick={() => setSelection(undefined)}
                >
                  {t('Replay traffic graph')}
                </KialiLink>
                {tabs.map(tab => (
                  <Button
                    key={tab.name}
                    variant="link"
                    isInline
                    data-test={`health-history-tab-${tab.name}`}
                    onClick={() => {
                      onSelect(tab.name, range);
                      setSelection(undefined);
                    }}
                  >
                    {tab.title}
                  </Button>
                ))}
              </StackItem>
            </Stack>
          ) : null
        }
      >
        {props.children(handleSelect)}
      </Popover>
    </div>
  );
};
