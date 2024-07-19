import * as React from 'react';
import { Refresh } from '../Refresh/Refresh';
import { TimeDurationComponent } from './TimeDurationComponent';
import { TimeRangeComponent } from './TimeRangeComponent';
import { useKialiTranslation } from 'utils/I18nUtils';

type TimeControlProps = {
  customDuration: boolean;
};

export const TimeControl: React.FC<TimeControlProps> = (props: TimeControlProps) => {
  const { t } = useKialiTranslation();

  const timeControlComponent = (
    <TimeDurationComponent key={'DurationDropdown'} id="app-info-duration-dropdown" disabled={false} />
  );

  const timeRangeComponent = (
    <div style={{ display: 'flex' }}>
      <TimeRangeComponent manageURL={true} tooltip={t('Time range')} />
      <Refresh id="metrics-refresh" hideLabel={true} manageURL={true} />
    </div>
  );

  return props.customDuration ? timeRangeComponent : timeControlComponent;
};
