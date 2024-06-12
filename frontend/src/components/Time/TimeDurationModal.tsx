import * as React from 'react';
import { Button, Form, FormGroup, Modal, ModalVariant, TooltipPosition } from '@patternfly/react-core';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { HistoryManager, URLParam } from '../../app/History';
import { useKialiDispatch, useKialiSelector } from '../../hooks/redux';
import { DurationInSeconds, IntervalInMilliseconds, TimeRange } from '../../types/Common';
import { DurationDropdownComponent } from '../Dropdown/DurationDropdown';
import { RefreshComponent } from '../Refresh/Refresh';
import { TimeRangeComp } from './TimeRangeComponent';
import { kioskDurationAction, kioskTimeRangeAction } from '../Kiosk/KioskActions';
import { useKialiTranslation } from 'utils/I18nUtils';

interface Props {
  customDuration: boolean;
  isOpen: boolean;

  onCancel?: () => void;
  onConfirm?: () => void;
}

export const TimeDurationModal: React.FC<Props> = (props: Props) => {
  const dispatch = useKialiDispatch();
  const { t, i18n } = useKialiTranslation();

  const reduxDuration = useKialiSelector(state => state.userSettings.duration);
  const reduxRefreshInterval = useKialiSelector(state => state.userSettings.refreshInterval);
  const reduxTimeRange = useKialiSelector(state => state.userSettings.timeRange);

  const [duration, setDuration] = React.useState(reduxDuration);
  const [refreshInterval, setRefreshInterval] = React.useState(reduxRefreshInterval);
  const [timeRange, setTimeRange] = React.useState(reduxTimeRange);

  const handleCancel = (): void => {
    // reset the dialog
    setDuration(reduxDuration);
    setRefreshInterval(reduxRefreshInterval);
    setTimeRange(reduxTimeRange);
    HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(reduxRefreshInterval));

    if (props.onCancel) {
      props.onCancel();
    }
  };

  const handleConfirm = (): void => {
    dispatch(UserSettingsActions.setRefreshInterval(refreshInterval));

    if (!props.customDuration) {
      dispatch(UserSettingsActions.setDuration(duration));
      kioskDurationAction(duration);
    } else {
      dispatch(UserSettingsActions.setTimeRange(timeRange));
      kioskTimeRangeAction(timeRange);
    }

    if (props.onConfirm) {
      props.onConfirm();
    }
  };

  const handleSetDuration = (d: DurationInSeconds): void => {
    setDuration(d);
  };

  const handleSetRefreshInterval = (r: IntervalInMilliseconds): void => {
    setRefreshInterval(r);
  };

  const handleSetTimeRange = (r: TimeRange): void => {
    setTimeRange(r);
  };

  return (
    <Modal
      aria-label={t('Time duration')}
      variant={ModalVariant.small}
      width={700}
      isOpen={props.isOpen}
      showClose={false}
      actions={[
        <Button key="confirm" variant="primary" onClick={handleConfirm}>
          {t('Confirm')}
        </Button>,

        <Button key="cancel" variant="link" onClick={handleCancel}>
          {t('Cancel')}
        </Button>
      ]}
      position="top"
    >
      <Form isHorizontal={true}>
        {props.customDuration ? (
          <FormGroup label={t('Time range')} fieldId="drform-time-range">
            <div style={{ display: 'flex' }}>
              <TimeRangeComp timeRange={timeRange} setTimeRange={handleSetTimeRange} tooltip={t('Time range')} />
            </div>
          </FormGroup>
        ) : (
          <FormGroup label={t('Duration')} fieldId="drform-duration">
            <DurationDropdownComponent
              id={'drform-duration-dd'}
              disabled={false}
              duration={duration}
              prefix={t('Last')}
              setDuration={handleSetDuration}
              tooltip={t('Traffic metrics per refresh')}
              tooltipPosition={TooltipPosition.top}
            />
          </FormGroup>
        )}

        <FormGroup label={t('Refresh interval')} fieldId="drform-refresh">
          <RefreshComponent
            id="drform-metrics-refresh"
            hideLabel={true}
            hideRefreshButton={true}
            language={i18n.language}
            refreshInterval={refreshInterval}
            setRefreshInterval={handleSetRefreshInterval}
          />
        </FormGroup>
      </Form>
    </Modal>
  );
};
