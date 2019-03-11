import * as React from 'react';

import { URLParam, HistoryManager } from '../../app/History';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { Reporter, Direction } from '../../types/MetricsOptions';

interface Props {
  onChanged: (reproter: Reporter) => void;
  direction: Direction;
}

export default class MetricsReporter extends React.Component<Props> {
  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source'
  };

  private reporter: Reporter;

  static initialReporter = (direction: Direction): Reporter => {
    const reporterParam = HistoryManager.getParam(URLParam.REPORTER);
    if (reporterParam !== undefined) {
      return reporterParam as Reporter;
    }
    return direction === 'inbound' ? 'destination' : 'source';
  };

  constructor(props: Props) {
    super(props);
    this.reporter = MetricsReporter.initialReporter(props.direction);
  }

  onReporterChanged = (reporter: string) => {
    HistoryManager.setParam(URLParam.REPORTER, reporter);
    this.reporter = reporter as Reporter;
    this.props.onChanged(this.reporter);
  };

  render() {
    return (
      <ToolbarDropdown
        id={'metrics_filter_reporter'}
        disabled={false}
        handleSelect={this.onReporterChanged}
        nameDropdown={'Reported from'}
        value={this.reporter}
        initialLabel={MetricsReporter.ReporterOptions[this.reporter]}
        options={MetricsReporter.ReporterOptions}
      />
    );
  }
}
