import * as React from 'react';
import { Refresh } from '../Refresh/Refresh';
import { TimeDurationComponent } from './TimeDurationComponent';
import { TimeRangeComponent } from './TimeRangeComponent';
import { useKialiTranslation } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';

type TimeControlProps = {
  customDuration: boolean;
};

const timeRangeStyle = kialiStyle({
  display: 'flex',
  gap: '0.5rem'
});

export const TimeControl: React.FC<TimeControlProps> = (props: TimeControlProps) => {
  const { t } = useKialiTranslation();

  const timeControlComponent = (
    <TimeDurationComponent key={'DurationDropdown'} id="app-info-duration-dropdown" disabled={false} />
  );

  const timeRangeComponent = (
    <div className={timeRangeStyle}>
      <TimeRangeComponent manageURL={true} tooltip={t('Time range')} />
      <Refresh id="metrics-refresh" manageURL={true} />
    </div>
  );

  return props.customDuration ? timeRangeComponent : timeControlComponent;
};
