// Assisted-by: OpenAI Codex
import * as React from 'react';
import {
  Button,
  Divider,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Popover,
  Stack,
  StackItem,
  Tooltip
} from '@patternfly/react-core';
import { createIcon, KialiIcon } from 'config/KialiIcon';
import { statusFromString, type HealthStatusId } from 'types/Health';
import { KialiLink } from 'components/Link/KialiLink';
import { CustomTimeTabsContext } from 'components/Tab/CustomTimeTabs';
import { useKialiSelector } from 'hooks/redux';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { useKialiTranslation } from 'utils/I18nUtils';
import type { HealthHistoryType } from 'services/Api';
import { getHealthHistoryGraphUrl, getHealthHistoryRange } from './HealthHistoryNavigation';

type HealthHistoryActionsProps = {
  children: (onSelect: (timestamp: number, position: number, status: HealthStatusId) => void) => React.ReactElement;
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

const headerStyle = kialiStyle({
  alignItems: 'center',
  display: 'inline-flex',
  gap: PFSpacer.sm
});

const bodyStyle = kialiStyle({
  paddingTop: PFSpacer.sm
});

const timeRangeStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.sm
});

const timeOptions: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit'
};

const dateTimeOptions: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  ...timeOptions
};

const formatTime = (timestamp: number, referenceTimestamp: number): string => {
  const date = new Date(timestamp);
  const sameDay = date.toDateString() === new Date(referenceTimestamp).toDateString();
  return sameDay ? date.toLocaleTimeString(undefined, timeOptions) : date.toLocaleString(undefined, dateTimeOptions);
};

export const HealthHistoryActions: React.FC<HealthHistoryActionsProps> = props => {
  const { t } = useKialiTranslation();
  const { onSelect, tabs } = React.useContext(CustomTimeTabsContext);
  const graphDuration = useKialiSelector(state => state.userSettings.duration);
  const anchorRef = React.useRef<HTMLSpanElement>(null);
  const [selection, setSelection] = React.useState<{
    now: number;
    position: number;
    status: HealthStatusId;
    timestamp: number;
  }>();
  const [duration, setDuration] = React.useState(600);
  const [isHelpOpen, setIsHelpOpen] = React.useState(false);
  const range = selection ? getHealthHistoryRange(selection.timestamp, duration, selection.now) : undefined;
  const options: Record<string, string> = {
    300: t('5 minutes'),
    600: t('10 minutes'),
    1800: t('30 minutes')
  };

  const handleSelect = React.useCallback((timestamp: number, position: number, status: HealthStatusId): void => {
    setIsHelpOpen(false);
    setSelection({ now: Date.now(), position, status, timestamp: Math.floor(timestamp / 60) * 60 });
  }, []);

  const statusLabel = selection ? t(selection.status === 'NA' ? 'n/a' : selection.status) : '';

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
        headerContent={
          selection ? (
            <span className={headerStyle}>
              {formatTime(selection.timestamp * 1000, selection.now)}
              <Tooltip content={statusLabel}>
                <span aria-label={statusLabel} data-test="health-history-selected-status" role="img" tabIndex={0}>
                  {createIcon(statusFromString(selection.status))}
                </span>
              </Tooltip>
              <Popover
                position="right"
                headerContent={t('Investigation Time Range')}
                onShow={() => setIsHelpOpen(true)}
                onHide={() => setIsHelpOpen(false)}
                bodyContent={t(
                  'Centers a custom time range on the selected time when possible. Choose an investigation page below to open it with this range preset.'
                )}
              >
                <Button
                  variant="plain"
                  isInline
                  hasNoPadding
                  icon={<KialiIcon.Help />}
                  aria-label={t('About the investigation time range')}
                  data-test="health-history-time-range-help"
                />
              </Popover>
            </span>
          ) : null
        }
        position="top"
        isVisible={selection !== undefined}
        shouldClose={() => {
          // Dismiss nested help before closing the troubleshooting actions.
          if (!isHelpOpen) {
            setSelection(undefined);
          }
        }}
        bodyContent={
          range && selection ? (
            <Stack hasGutter className={bodyStyle} data-test="health-history-actions">
              <StackItem>
                <Divider />
              </StackItem>
              <StackItem>
                <FormGroup
                  className={timeRangeStyle}
                  label={t('Investigation Time Range')}
                  fieldId="health-history-window"
                >
                  <div className={timeRangeStyle}>
                    <FormSelect
                      id="health-history-window"
                      aria-label={t('Investigation Time Range')}
                      value={duration}
                      onChange={(_event, value) => setDuration(Number(value))}
                      data-test="health-history-window"
                    >
                      {Object.entries(options).map(([seconds, label]) => (
                        <FormSelectOption key={seconds} value={seconds} label={label} />
                      ))}
                    </FormSelect>
                    <div data-test="health-history-investigation-range">
                      {formatTime(range.from, selection.timestamp * 1000)} –{' '}
                      {formatTime(range.to, selection.timestamp * 1000)}
                    </div>
                  </div>
                </FormGroup>
              </StackItem>
              <StackItem>
                <Divider />
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
                  {t('Traffic Graph Replay')}
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
