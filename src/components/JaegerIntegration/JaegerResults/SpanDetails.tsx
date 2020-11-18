import * as React from 'react';
import { Card, CardBody } from '@patternfly/react-core';

import { JaegerTrace, Span } from 'types/JaegerInfo';
import { SpanTable } from './SpanTable';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { FilterSelected, StatefulFilters } from 'components/Filters/StatefulFilters';
import { buildItemData, SpanItemData } from './SpanTableItem';
import { spanFilters } from './Filters';
import { runFilters } from 'components/FilterList/FilterHelper';
import { ActiveFiltersInfo } from 'types/Filters';
import { TraceLabels } from './TraceLabels';

interface Props {
  trace?: JaegerTrace;
  namespace: string;
  target: string;
  externalURL?: string;
}

interface State {
  spanSelected?: Span;
  activeFilters: ActiveFiltersInfo;
}

class SpanDetails extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const filters = spanFilters(this.buildSpansItems());
    this.state = {
      activeFilters: FilterSelected.init(filters)
    };
  }

  private buildSpansItems = (): SpanItemData[] => {
    return this.props.trace?.spans.map(s => buildItemData(s, this.props.namespace)) || [];
  };

  render() {
    if (!this.props.trace) {
      return null;
    }

    const items = this.buildSpansItems();
    const filters = spanFilters(items);
    const filteredItems = runFilters(items, filters, this.state.activeFilters);
    return (
      <Card isCompact style={{ border: '1px solid #e6e6e6' }}>
        <CardBody>
          <StatefulFilters initialFilters={filters} onFilterChange={active => this.setState({ activeFilters: active })}>
            <TraceLabels
              spans={this.props.trace.spans}
              filteredSpans={this.state.activeFilters.filters.length > 0 ? filteredItems : undefined}
              oneline={true}
            />
          </StatefulFilters>
          <SpanTable items={filteredItems} namespace={this.props.namespace} externalURL={this.props.externalURL} />
        </CardBody>
      </Card>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  trace: state.jaegerState.selectedTrace
});

const Container = connect(mapStateToProps)(SpanDetails);
export default Container;
