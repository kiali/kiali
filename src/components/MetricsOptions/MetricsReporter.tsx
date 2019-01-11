import * as React from 'react';

import history, { URLParams, HistoryManager } from '../../app/History';
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

  private shouldReportOptions: boolean;
  private reporter: Reporter;

  static initialReporter = (direction: Direction): Reporter => {
    const urlParams = new URLSearchParams(history.location.search);
    const reporterParam = urlParams.get(URLParams.REPORTER);
    if (reporterParam != null) {
      return reporterParam as Reporter;
    }
    return direction === 'inbound' ? 'destination' : 'source';
  };

  constructor(props: Props) {
    super(props);
  }

  componentDidUpdate() {
    if (this.shouldReportOptions) {
      this.shouldReportOptions = false;
      this.props.onChanged(this.reporter);
    }
  }

  onReporterChanged = (reporter: string) => {
    HistoryManager.setParam(URLParams.REPORTER, reporter);
  };

  render() {
    this.processUrlParams();
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

  processUrlParams() {
    const reporter = MetricsReporter.initialReporter(this.props.direction);
    this.shouldReportOptions = reporter !== this.reporter;
    this.reporter = reporter;
  }
}
