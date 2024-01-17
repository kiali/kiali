import * as React from 'react';

import { URLParam, HistoryManager } from '../../app/History';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { Reporter, Direction } from '../../types/MetricsOptions';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';

interface Props {
  onChanged: (reproter: Reporter) => void;
  direction: Direction;
  reporter: Reporter;
}

const infoStyle = kialiStyle({
  margin: '0px 5px 2px 5px'
});

export class MetricsReporter extends React.Component<Props> {
  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source',
    both: 'Both'
  };

  static initialReporter = (direction: Direction): Reporter => {
    const reporterParam = HistoryManager.getParam(URLParam.REPORTER);
    if (reporterParam !== undefined) {
      return reporterParam as Reporter;
    }
    return direction === 'inbound' ? 'destination' : 'source';
  };

  onReporterChanged = (reporter: string) => {
    HistoryManager.setParam(URLParam.REPORTER, reporter);
    const newReporter = reporter as Reporter;
    this.props.onChanged(newReporter);
  };

  reportTooltip = (
    <div>
      <ul style={{ listStyleType: 'none' }}>
        <li>
          <div style={{ display: 'inline-block' }}>
            Select the reporter for the metrics displayed. Each Istio metric can be reported by the Source (workload
            which emitted the request) and by the Destination (workload which received the request). In general, the
            timeseries will look exactly the same because Source and Destination report the same data.
          </div>
        </li>
        <li>
          <div style={{ display: 'inline-block' }}>There are some exceptions:</div>
        </li>
        <li>
          <ul style={{ listStyleType: 'circle', marginLeft: '20px' }}>
            <li>An opened circuit breaker would cause networking failures only reported by the Source</li>
            <li>Fault-injected failures only reported by the Source</li>
            <li>
              Traffic coming from unknown sources (anything that is not under the Istio mesh) would only be reported by
              the Destination
            </li>
          </ul>
        </li>
      </ul>
    </div>
  );

  render() {
    return (
      <span>
        <ToolbarDropdown
          id={'metrics_filter_reporter'}
          disabled={false}
          handleSelect={this.onReporterChanged}
          nameDropdown={'Reported from'}
          value={this.props.reporter}
          label={MetricsReporter.ReporterOptions[this.props.reporter]}
          options={MetricsReporter.ReporterOptions}
        />
        <Tooltip content={<div style={{ textAlign: 'left' }}>{this.reportTooltip}</div>} position={TooltipPosition.top}>
          <KialiIcon.Info className={infoStyle} />
        </Tooltip>
      </span>
    );
  }
}
