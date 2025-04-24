import * as React from 'react';
import { Refresh } from '../Refresh/Refresh';
import { TimeDurationComponent } from './TimeDurationComponent';
import { TimeRangeComponent } from './TimeRangeComponent';
import { useKialiTranslation } from 'utils/I18nUtils';
import { kialiStyle } from 'styles/StyleUtils';

type TimeControlProps = {
  customDuration: boolean;
};

const refreshStyle = kialiStyle({
  marginLeft: '0.4rem',
  marginRight: '0.4rem'
});

export const TimeControl: React.FC<TimeControlProps> = (props: TimeControlProps) => {
  const { t } = useKialiTranslation();

  const timeControlComponent = (
    <TimeDurationComponent key={'DurationDropdown'} id="app-info-duration-dropdown" disabled={false} />
  );

  const timeRangeComponent = (
    <div style={{ display: 'flex' }}>
      <TimeRangeComponent manageURL={true} tooltip={t('Time range')} />
      <Refresh className={refreshStyle} id="metrics-refresh" manageURL={true} />
    </div>
  );

  return props.customDuration ? timeRangeComponent : timeControlComponent;
};
