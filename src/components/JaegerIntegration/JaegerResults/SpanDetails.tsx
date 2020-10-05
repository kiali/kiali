import * as React from 'react';
import { groupBy } from 'lodash';
import { style } from 'typestyle';
import { Button, Card, CardBody } from '@patternfly/react-core';

import { JaegerTrace, Span } from 'types/JaegerInfo';
import { SpanTable } from './SpanTable';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';

const labelStyle = style({
  margin: '5px'
});

interface SpanDetailsProps {
  trace?: JaegerTrace;
  namespace: string;
  target: string;
  externalURL?: string;
}

interface SpanDetailsState {
  selectedApps: string[];
  spanSelected?: Span;
  isModalOpen: boolean;
}

class SpanDetails extends React.Component<SpanDetailsProps, SpanDetailsState> {
  constructor(props: SpanDetailsProps) {
    super(props);
    this.state = { isModalOpen: false, selectedApps: [] };
  }

  private onClickApp = (app: string) => {
    if (this.state.selectedApps.indexOf(app) >= 0) {
      // Remove
      this.setState({ selectedApps: this.state.selectedApps.filter(a => a !== app) });
    } else {
      // Add
      this.setState({ selectedApps: this.state.selectedApps.concat([app]) });
    }
  };

  private getClassButtonSpan = (app: string) => {
    if (this.state.selectedApps.indexOf(app) >= 0) {
      return 'primary';
    } else {
      if (this.props.target === app || this.props.target + '.' + this.props.namespace === app) {
        return 'tertiary';
      } else {
        return 'secondary';
      }
    }
  };

  render() {
    if (!this.props.trace) {
      return null;
    }

    const spans =
      this.state.selectedApps.length === 0
        ? this.props.trace.spans
        : this.props.trace.spans.filter(span => this.state.selectedApps.indexOf(span.process.serviceName) >= 0);
    const spansPerApp = groupBy(this.props.trace.spans, s => s.process.serviceName);
    const apps = Object.keys(spansPerApp).sort();
    return (
      <Card isCompact style={{ border: '1px solid #e6e6e6' }}>
        <CardBody>
          Filter by app{' '}
          {apps.map(app => {
            const spans = spansPerApp[app];
            return (
              <Button
                variant={this.getClassButtonSpan(app)}
                onClick={() => this.onClickApp(app)}
                className={labelStyle}
                key={`span_button_${app}`}
              >
                {app} ({spans.length})
              </Button>
            );
          })}
          <SpanTable spans={spans} namespace={this.props.namespace} externalURL={this.props.externalURL} />
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
