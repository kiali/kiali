import * as React from 'react';
import { Aggregator } from 'types/MetricsOptions';

import { URLParam, HistoryManager } from '../../app/History';
import { ToolbarDropdown } from '../ToolbarDropdown/ToolbarDropdown';

interface Props {
  onChanged: (aggregator: Aggregator) => void;
}

export class MetricsRawAggregation extends React.Component<Props> {
  static Aggregators: { [key: string]: string } = {
    sum: 'Sum',
    avg: 'Average',
    min: 'Min',
    max: 'Max',
    stddev: 'Standard deviation',
    stdvar: 'Standard variance'
  };

  private aggregator: Aggregator;

  static initialAggregator = (): Aggregator => {
    const opParam = HistoryManager.getParam(URLParam.AGGREGATOR);
    if (opParam !== undefined) {
      return opParam as Aggregator;
    }
    return 'sum';
  };

  constructor(props: Props) {
    super(props);
    this.aggregator = MetricsRawAggregation.initialAggregator();
  }

  onAggregatorChanged = (aggregator: string) => {
    HistoryManager.setParam(URLParam.AGGREGATOR, aggregator);
    this.aggregator = aggregator as Aggregator;
    this.props.onChanged(this.aggregator);
  };

  render() {
    return (
      <ToolbarDropdown
        id={'metrics_filter_aggregator'}
        disabled={false}
        handleSelect={this.onAggregatorChanged}
        nameDropdown={'Pods aggregation'}
        value={this.aggregator}
        label={MetricsRawAggregation.Aggregators[this.aggregator]}
        options={MetricsRawAggregation.Aggregators}
      />
    );
  }
}
