import * as React from 'react';
import { sortBy } from 'lodash';
import { Button, Card, CardBody, Label, Grid, GridItem } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { JaegerTrace, Span } from '../../../types/JaegerInfo';
import { JaegerTraceTitle } from './JaegerTraceTitle';
import { SpanDetail } from './SpanDetail';
import { style } from 'typestyle';
import { isErrorTag } from '../JaegerHelper';
import { PfColors } from '../../Pf/PfColors';
import { getFormattedTraceInfo } from './FormattedTraceInfo';
import { CytoscapeGraphSelectorBuilder } from 'components/CytoscapeGraph/CytoscapeGraphSelector';
import { GraphType, NodeType } from 'types/Graph';

const labelStyle = style({
  margin: '5px'
});

interface Props {
  trace: JaegerTrace;
  jaegerURL: string;
  namespace: string;
  target: string;
  targetKind: 'app' | 'workload' | 'service';
}

interface State {
  spansSelected: Span[];
  appSelected: string;
}

export class TraceDetails extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { spansSelected: [], appSelected: '' };
  }

  private getClassButtonSpan = (app: string) => {
    if (this.state.appSelected === app) {
      return 'primary';
    } else {
      if (this.props.target === app || this.props.target + '.' + this.props.namespace === app) {
        return 'tertiary';
      } else {
        return 'secondary';
      }
    }
  };

  private onClickApp = (app: string) => {
    this.setState({
      appSelected: app,
      spansSelected: this.props.trace.spans.filter(span => span.process.serviceName === app)
    });
  };

  private getGraphURL = () => {
    let cytoscapeGraph = new CytoscapeGraphSelectorBuilder().namespace(this.props.namespace);
    let graphType: GraphType = GraphType.APP;

    switch (this.props.targetKind) {
      case 'app':
        cytoscapeGraph = cytoscapeGraph.app(this.props.target).nodeType(NodeType.APP).isGroup(null);
        break;
      case 'service':
        graphType = GraphType.SERVICE;
        cytoscapeGraph = cytoscapeGraph.service(this.props.target);
        break;
      case 'workload':
        graphType = GraphType.WORKLOAD;
        cytoscapeGraph = cytoscapeGraph.workload(this.props.target);
        break;
    }

    return `/graph/namespaces?graphType=${graphType}&injectServiceNodes=true&namespaces=${
      this.props.namespace
    }&traceId=${this.props.trace.traceID}&focusSelector=${encodeURI(cytoscapeGraph.build())}`;
  };

  render() {
    const { trace, jaegerURL } = this.props;
    const formattedTrace = getFormattedTraceInfo(trace);
    return (
      <Card isCompact style={{ border: '1px solid #e6e6e6' }}>
        <JaegerTraceTitle
          traceID={trace.traceID}
          formattedTrace={formattedTrace}
          onClickLink={jaegerURL !== '' ? `${jaegerURL}/trace/${trace.traceID}` : ''}
          graphURL={this.getGraphURL()}
        />
        <CardBody>
          <Grid style={{ marginTop: '20px' }}>
            <GridItem span={2}>
              <Label>{formattedTrace.spans}</Label>
              {formattedTrace.errors && (
                <Label style={{ marginLeft: '10px', backgroundColor: PfColors.Red200 }}>{formattedTrace.errors}</Label>
              )}
            </GridItem>
            <GridItem span={8}>
              {sortBy(trace.services, s => s.name).map(app => {
                const { name, numberOfSpans: count } = app;
                const spans = trace.spans.filter(span => span.process.serviceName === name);
                const errorSpans = spans.filter(span => span.tags.some(isErrorTag)).length;
                return (
                  <Button
                    variant={this.getClassButtonSpan(name)}
                    onClick={() => this.onClickApp(name)}
                    className={labelStyle}
                    key={`span_button_${name}`}
                  >
                    {name} ({count} {errorSpans > 0 && <ExclamationCircleIcon color={PfColors.Red200} />})
                  </Button>
                );
              })}
            </GridItem>
            <GridItem span={2} style={{ textAlign: 'right' }}>
              {formattedTrace.relativeDate}
              <span style={{ padding: '0 10px 0 10px' }}>|</span>
              {formattedTrace.absTime}
              <br />
              <small>{formattedTrace.fromNow}</small>
            </GridItem>
            {this.state.spansSelected.length > 0 && (
              <GridItem span={12}>
                <SpanDetail spans={this.state.spansSelected} />
              </GridItem>
            )}
          </Grid>
        </CardBody>
      </Card>
    );
  }
}
