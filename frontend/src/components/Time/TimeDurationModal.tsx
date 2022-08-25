import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Form, FormGroup, Modal, ModalVariant, TooltipPosition } from "@patternfly/react-core";
import { UserSettingsActions } from "../../actions/UserSettingsActions";
import { HistoryManager, URLParam } from "../../app/History";
import { KialiAppState } from "../../store/Store";
import {DurationInSeconds, IntervalInMilliseconds, TimeRange} from "../../types/Common";
import { KialiDispatch } from "../../types/Redux";
import { DurationDropdownComponent } from "../DurationDropdown/DurationDropdown";
import { Refresh } from "../Refresh/Refresh";
import { TimeRangeComponent } from "./TimeRangeComponent";

interface Props {
  customDuration: boolean;
  isOpen: boolean;

  onCancel?: () => void;
  onConfirm?: () => void;
}

export function TimeDurationModal(props: Props) {
  const dispatch = useDispatch<KialiDispatch>();
  const reduxDuration = useSelector<KialiAppState, DurationInSeconds>((state) => state.userSettings.duration);
  const reduxRefreshInterval = useSelector<KialiAppState, IntervalInMilliseconds>((state) => state.userSettings.refreshInterval);
  const reduxTimeRange = useSelector<KialiAppState, TimeRange>((state) => state.userSettings.timeRange);

  const [duration, setDuration] = React.useState<DurationInSeconds>(reduxDuration);
  const [refreshInterval, setRefreshInterval] = React.useState<IntervalInMilliseconds>(reduxRefreshInterval);
  const [timeRange, setTimeRange] = React.useState<TimeRange>(reduxTimeRange);

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
    dispatch(UserSettingsActions.setDuration(duration));
    if (!props.customDuration) {
      dispatch(UserSettingsActions.setRefreshInterval(refreshInterval));
    } else {
      dispatch(UserSettingsActions.setTimeRange(timeRange));
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
      variant={ModalVariant.small}
      width={700}
      isOpen={props.isOpen}
      showClose={false}
      actions={[<Button key="confirm" variant="primary" onClick={handleConfirm}>Confirm</Button>,<Button key="cancel" variant="link" onClick={handleCancel}>Cancel</Button>]}
    >
      <Form isHorizontal={true}>
        {props.customDuration ? (
          <FormGroup
            label="Time range"
            fieldId="drform-time-range"
          >
            <div style={{display: "flex"}}>
              <TimeRangeComponent menuAppendTo="parent" timeRange={timeRange} setTimeRange={handleSetTimeRange} tooltip={'Time range'} />
            </div>
          </FormGroup>
        ) : (
          <FormGroup
            label="Duration"
            fieldId="drform-duration"
          >
            <DurationDropdownComponent
              id={'drform-duration-dd'}
              disabled={false}
              duration={duration}
              menuAppendTo="parent"
              prefix="Last"
              setDuration={handleSetDuration}
              tooltip="Traffic metrics per refresh"
              tooltipPosition={TooltipPosition.top}
            />
          </FormGroup>
        )}
        <FormGroup
          label="Refresh interval"
          fieldId="drform-refresh"
        >
          <Refresh
            id="drform-metrics-refresh"
            hideLabel={true}
            hideRefreshButton={true}
            menuAppendTo="parent"
            refreshInterval={refreshInterval}
            setRefreshInterval={handleSetRefreshInterval}
            setLastRefreshAt={() => undefined}
          />
        </FormGroup>
      </Form>
    </Modal>
  );
}
