import * as React from 'react';
import { sortBy } from 'lodash';
import { Button, Card, CardBody, Label, Grid, GridItem } from '@patternfly/react-core';
import { ExclamationCircleIcon } from '@patternfly/react-icons';
import { JaegerTrace, Span } from '../../../types/JaegerInfo';
import { JaegerTraceTitle } from './JaegerTraceTitle';
import { SpanDetail } from './SpanDetail';
import { style } from 'typestyle';
import moment from 'moment';
import { formatRelativeDate, cleanServiceSelector } from './transform';
import { isErrorTag } from '../RouteHelper';
import { KialiAppState } from '../../../store/Store';
import { connect } from 'react-redux';
import { PfColors } from '../../Pf/PfColors';

const labelStyle = style({
  margin: '5px'
});

interface JaegerScatterProps {
  trace: JaegerTrace;
  namespaceSelector: boolean;
  namespace: string;
  service: string;
  jaegerURL: string;
}

interface JaegerScatterState {
  spansSelected: Span[];
  serviceSelected: string;
}
class JaegerItemC extends React.Component<JaegerScatterProps, JaegerScatterState> {
  constructor(props: JaegerScatterProps) {
    super(props);
    this.state = { spansSelected: [], serviceSelected: '' };
  }

  getClassButtonSpan = (service: string) => {
    if (this.state.serviceSelected === service) {
      return 'primary';
    } else {
      const srv = this.props.namespaceSelector ? cleanServiceSelector(service, this.props.namespace) : service;
      if (this.props.service === srv) {
        return 'tertiary';
      } else {
        return 'secondary';
      }
    }
  };

  onClickService = (service: string) => {
    this.setState({
      serviceSelected: service,
      spansSelected: this.props.trace.spans.filter(span => span.process.serviceName === service)
    });
  };

  render() {
    const { trace } = this.props;
    const { duration, services, spans, startTime } = trace;
    const numSpans = spans.length;
    const mDate = moment(startTime / 1000);
    const fromNow = mDate.fromNow();
    const timeStr = mDate.format('h:mm:ss a');
    const numErredSpans = spans.filter(sp => sp.tags.some(isErrorTag)).length;
    return (
      <Card isCompact style={{ border: '1px solid #e6e6e6' }}>
        <JaegerTraceTitle
          trace={trace}
          duration={duration}
          onClickLink={this.props.jaegerURL !== '' ? `${this.props.jaegerURL}/trace/${this.props.trace.traceID}` : ''}
        />
        <CardBody>
          <Grid style={{ marginTop: '20px' }}>
            <GridItem span={2}>
              <Label>
                {numSpans} Span{numSpans > 1 && 's'}
              </Label>
              {Boolean(numErredSpans) && (
                <Label style={{ marginLeft: '10px', backgroundColor: PfColors.Red200 }}>
                  {numErredSpans} Error{numErredSpans > 1 && 's'}
                </Label>
              )}
            </GridItem>
            <GridItem span={8}>
              {sortBy(services, s => s.name).map(service => {
                const { name, numberOfSpans: count } = service;
                const spans = trace.spans.filter(span => span.process.serviceName === name);
                const errorSpans = spans.filter(span => span.tags.some(isErrorTag)).length;
                return (
                  <Button
                    variant={this.getClassButtonSpan(name)}
                    onClick={() => this.onClickService(name)}
                    className={labelStyle}
                    key={`span_button_${name}`}
                  >
                    {name} ({count} {errorSpans > 0 && <ExclamationCircleIcon color={PfColors.Red200} />})
                  </Button>
                );
              })}
            </GridItem>
            <GridItem span={2} style={{ textAlign: 'right' }}>
              {formatRelativeDate(startTime / 1000)}
              <span style={{ padding: '0 10px 0 10px' }}>|</span>
              {timeStr.slice(0, -3)}&nbsp;{timeStr.slice(-2)}
              <br />
              <small>{fromNow}</small>
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

const mapStateToProps = (state: KialiAppState) => {
  return {
    namespaceSelector: state.jaegerState ? state.jaegerState.namespaceSelector : true
  };
};

export const JaegerItem = connect(mapStateToProps)(JaegerItemC);

export default JaegerItem;
