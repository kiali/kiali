import * as React from 'react';
import { Button, Form, FormGroup, Modal, ModalVariant, TooltipPosition } from '@patternfly/react-core';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { HistoryManager, URLParam } from '../../app/History';
import { useKialiDispatch, useKialiSelector } from '../../hooks/redux';
import { DurationInSeconds, IntervalInMilliseconds, TimeRange } from '../../types/Common';
import { DurationDropdownComponent } from '../DurationDropdown/DurationDropdown';
import { RefreshComponent } from '../Refresh/Refresh';
import { TimeRangeComp } from './TimeRangeComponent';
import { kioskDurationAction, kioskTimeRangeAction } from '../Kiosk/KioskActions';

interface Props {
  customDuration: boolean;
  isOpen: boolean;

  onCancel?: () => void;
  onConfirm?: () => void;
}

export function TimeDurationModal(props: Props) {
  const dispatch = useKialiDispatch();
  const reduxDuration = useKialiSelector(state => state.userSettings.duration);
  const reduxRefreshInterval = useKialiSelector(state => state.userSettings.refreshInterval);
  const reduxTimeRange = useKialiSelector(state => state.userSettings.timeRange);

  const [duration, setDuration] = React.useState(reduxDuration);
  const [refreshInterval, setRefreshInterval] = React.useState(reduxRefreshInterval);
  const [timeRange, setTimeRange] = React.useState(reduxTimeRange);

  function handleCancel() {
    // reset the dialog
    setDuration(reduxDuration);
    setRefreshInterval(reduxRefreshInterval);
    setTimeRange(reduxTimeRange);
    HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(reduxRefreshInterval));

    if (props.onCancel) {
      props.onCancel();
    }
  }

  function handleConfirm() {
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
  }

  function handleSetDuration(d: DurationInSeconds) {
    setDuration(d);
  }

  function handleSetRefreshInterval(r: IntervalInMilliseconds) {
    setRefreshInterval(r);
  }

  function handleSetTimeRange(r: TimeRange) {
    setTimeRange(r);
  }

  return (
    <Modal
      aria-label="time-duration"
      variant={ModalVariant.small}
      width={700}
      isOpen={props.isOpen}
      showClose={false}
      actions={[
        <Button key="confirm" variant="primary" onClick={handleConfirm}>
          Confirm
        </Button>,
        <Button key="cancel" variant="link" onClick={handleCancel}>
          Cancel
        </Button>
      ]}
      position="top"
    >
      <Form isHorizontal={true}>
        {props.customDuration ? (
          <FormGroup label="Time range" fieldId="drform-time-range">
            <div style={{ display: 'flex' }}>
              <TimeRangeComp timeRange={timeRange} setTimeRange={handleSetTimeRange} tooltip={'Time range'} />
            </div>
          </FormGroup>
        ) : (
          <FormGroup label="Duration" fieldId="drform-duration">
            <DurationDropdownComponent
              id={'drform-duration-dd'}
              disabled={false}
              duration={duration}
              prefix="Last"
              setDuration={handleSetDuration}
              tooltip="Traffic metrics per refresh"
              tooltipPosition={TooltipPosition.top}
            />
          </FormGroup>
        )}
        <FormGroup label="Refresh interval" fieldId="drform-refresh">
          <RefreshComponent
            id="drform-metrics-refresh"
            hideLabel={true}
            hideRefreshButton={true}
            refreshInterval={refreshInterval}
            setRefreshInterval={handleSetRefreshInterval}
          />
        </FormGroup>
      </Form>
    </Modal>
  );
}
