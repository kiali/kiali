import * as React from 'react';
import { FormGroup, Toolbar } from 'patternfly-react';

import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { URLParams, HistoryManager } from '../../app/History';
import { Reporter, Direction, MetricsOptions } from '../../types/MetricsOptions';

import MetricsOptionsBar from './MetricsOptionsBar';

export interface IstioMetricsOptionsBarProps {
  direction: Direction;
}

export class IstioMetricsOptionsBar extends MetricsOptionsBar<IstioMetricsOptionsBarProps> {
  static ReporterOptions: { [key: string]: string } = {
    destination: 'Destination',
    source: 'Source'
  };

  private reporter: Reporter;

  static initialReporter = (urlParams: URLSearchParams, direction: Direction): string => {
    const reporterParam = urlParams.get(URLParams.REPORTER);
    if (reporterParam != null) {
      return reporterParam;
    }
    return direction === 'inbound' ? 'destination' : 'source';
  };

  // Overrides
  protected reportOptions() {
    const opts = this.buildBaseOptions() as MetricsOptions;
    opts.direction = this.props.direction;
    opts.reporter = this.reporter;
    this.props.onOptionsChanged(opts);
  }

  onReporterChanged = (reporter: string) => {
    HistoryManager.setParam(URLParams.REPORTER, reporter);
  };

  // Overrides
  protected renderToolbar() {
    return (
      <Toolbar>
        {this.renderMetricsSettings()}
        <FormGroup>
          <ToolbarDropdown
            id={'metrics_filter_reporter'}
            disabled={false}
            handleSelect={this.onReporterChanged}
            nameDropdown={'Reported from'}
            value={this.reporter}
            initialLabel={IstioMetricsOptionsBar.ReporterOptions[this.reporter]}
            options={IstioMetricsOptionsBar.ReporterOptions}
          />
        </FormGroup>
        {this.renderGrafanaLink()}
        {this.renderRightContent()}
      </Toolbar>
    );
  }

  // Overrides
  protected processUrlParams(urlParams: URLSearchParams) {
    super.processUrlParams(urlParams);
    const reporter = IstioMetricsOptionsBar.initialReporter(urlParams, this.props.direction) as Reporter;
    if (reporter !== this.reporter) {
      super.markReportFlag();
      this.reporter = reporter;
    }
  }
}

export default IstioMetricsOptionsBar;
