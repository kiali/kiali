import * as React from "react";
import { style } from "typestyle";
import { Button, Tooltip } from "@patternfly/react-core";
import { config } from "../../config";
import { KialiIcon } from "../../config/KialiIcon";
import { useKialiSelector } from "../../hooks/redux";
import { guardTimeRange } from "../../types/Common";
import { getName, getRefreshIntervalName } from "../../utils/RateIntervals";

interface Props {
  isDuration?: boolean;
  onClick?: () => void;
}

const infoStyle = style({
  margin: '0px 5px 2px 5px',
  verticalAlign: '-5px !important'
});

export function TimeDurationIndicatorButton(props: Props) {
  const duration = useKialiSelector((state) => state.userSettings.duration);
  const refreshInterval = useKialiSelector((state) => state.userSettings.refreshInterval);
  const timeRange = useKialiSelector((state) => state.userSettings.timeRange);

  function timeDurationIndicator() {
    if (props.isDuration) {
      return getName(duration);
    } else {
      return guardTimeRange(timeRange, getName, () => '(custom)');
    }
  }

  function timeDurationDetailLabel() {
    return props.isDuration ? 'Current duration' : 'Current time range';
  }

  function timeDurationDetail() {
    if (props.isDuration) {
      return `Last ${getName(duration)}`
    } else {
      return guardTimeRange(
        timeRange,
        (d) => `Last ${getName(d)}`,
        (b) => (new Date(b.from!).toLocaleString() + ' to ' + (b.to ? new Date(b.to).toLocaleString() : 'now')))
    }
  }

  return (
    <Tooltip isContentLeftAligned={true} maxWidth={'50em'} content={
      <>
        <p>Select the time range of shown data, and the refresh interval.</p>
        <p style={{whiteSpace: 'nowrap'}}>
          {timeDurationDetailLabel()}: {timeDurationDetail()}
          <br />
          Current refresh interval: {config.toolbar.refreshInterval[refreshInterval]}
        </p>
      </>
    }>
      <Button variant="link" isInline={true} onClick={props.onClick}>
        <KialiIcon.Clock className={infoStyle} />
        {timeDurationIndicator()}, {getRefreshIntervalName(refreshInterval)}
      </Button>
    </Tooltip>
  )
}
