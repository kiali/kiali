import * as React from 'react';

import history, { URLParams, HistoryManager } from '../../app/History';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';
import { Aggregator } from '../../types/MetricsOptions';

interface Props {
  onChanged: (aggregator: Aggregator) => void;
}

export default class MetricsRawAggregation extends React.Component<Props> {
  static Aggregators: { [key: string]: string } = {
    sum: 'Sum',
    avg: 'Average',
    min: 'Min',
    max: 'Max',
    stddev: 'Standard deviation',
    stdvar: 'Standard variance'
  };

  private shouldReportOptions: boolean;
  private aggregator: Aggregator;

  static initialAggregator = (): Aggregator => {
    const urlParams = new URLSearchParams(history.location.search);
    const opParam = urlParams.get(URLParams.AGGREGATOR);
    if (opParam != null) {
      return opParam as Aggregator;
    }
    return 'sum';
  };

  constructor(props: Props) {
    super(props);
  }

  componentDidUpdate() {
    if (this.shouldReportOptions) {
      this.shouldReportOptions = false;
      this.props.onChanged(this.aggregator);
    }
  }

  onAggregatorChanged = (aggregator: string) => {
    HistoryManager.setParam(URLParams.AGGREGATOR, aggregator);
  };

  render() {
    this.processUrlParams();
    return (
      <ToolbarDropdown
        id={'metrics_filter_aggregator'}
        disabled={false}
        handleSelect={this.onAggregatorChanged}
        nameDropdown={'Pods aggregation'}
        value={this.aggregator}
        initialLabel={MetricsRawAggregation.Aggregators[this.aggregator]}
        options={MetricsRawAggregation.Aggregators}
      />
    );
  }

  processUrlParams() {
    const op = MetricsRawAggregation.initialAggregator();
    this.shouldReportOptions = op !== this.aggregator;
    this.aggregator = op;
  }
}
