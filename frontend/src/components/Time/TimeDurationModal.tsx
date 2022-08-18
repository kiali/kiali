import * as React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Button, Form, FormGroup, Modal, ModalVariant, TooltipPosition } from "@patternfly/react-core";
import { UserSettingsActions } from "../../actions/UserSettingsActions";
import { HistoryManager, URLParam } from "../../app/History";
import { KialiAppState } from "../../store/Store";
import { DurationInSeconds, IntervalInMilliseconds } from "../../types/Common";
import { KialiDispatch } from "../../types/Redux";
import { DurationDropdownComponent } from "../DurationDropdown/DurationDropdown";
import { Refresh } from "../Refresh/Refresh";

interface Props {
  isOpen: boolean;

  onCancel?: () => void;
  onConfirm?: () => void;
}

export function TimeDurationModal(props: Props) {
  const dispatch = useDispatch<KialiDispatch>();
  const reduxDuration = useSelector<KialiAppState, DurationInSeconds>((state) => state.userSettings.duration);
  const reduxRefreshInterval = useSelector<KialiAppState, IntervalInMilliseconds>((state) => state.userSettings.refreshInterval);

  const [duration, setDuration] = React.useState<DurationInSeconds>(reduxDuration);
  const [refreshInterval, setRefreshInterval] = React.useState<IntervalInMilliseconds>(reduxRefreshInterval);

  function handleCancel() {
    // reset the dialog
    setDuration(reduxDuration);
    setRefreshInterval(reduxRefreshInterval);
    HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(reduxRefreshInterval));

    if (props.onCancel) {
      props.onCancel();
    }
  }

  function handleConfirm() {
    dispatch(UserSettingsActions.setDuration(duration));
    dispatch(UserSettingsActions.setRefreshInterval(refreshInterval));
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

  return (
    <Modal
      variant={ModalVariant.small}
      isOpen={props.isOpen}
      showClose={false}
      actions={[<Button key="confirm" variant="primary" onClick={handleConfirm}>Confirm</Button>,<Button key="cancel" variant="link" onClick={handleCancel}>Cancel</Button>]}
    >
      <Form isHorizontal={true}>
        <FormGroup
          label="Duration"
          fieldId="drform-duration"
        >
          <DurationDropdownComponent
            id={'drform-duration-dd'}
            disabled={/*this.props.disabled*/ false}
            duration={duration}
            menuAppendTo="parent"
            prefix="Last"
            setDuration={handleSetDuration}
            tooltip="Traffic metrics per refresh"
            tooltipPosition={TooltipPosition.top}
          />
        </FormGroup>
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
