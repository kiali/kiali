import * as React from 'react';
import { SimpleList, SimpleListItem, Button, Checkbox, Tooltip } from '@patternfly/react-core';
import { style } from 'typestyle';

import history from '../../app/History';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { JaegerInfo, JaegerTrace } from 'types/JaegerInfo';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { TracingQuery } from 'types/Tracing';
import { TimeInSeconds } from 'types/Common';
import { transformTraceData } from 'components/JaegerIntegration/JaegerResults';
import { TraceListItem } from 'components/JaegerIntegration/TraceListItem';
import { summaryFont } from './SummaryPanelCommon';

type Props = {
  jaegerInfo?: JaegerInfo;
  namespace: string;
  service: string;
  queryTime: TimeInSeconds;
  setTraceId: (traceId?: string) => void;
};

type State = {
  traces: JaegerTrace[];
  keepList: boolean;
};

const tracesLimit = 15;

const checkboxStyle = style({
  paddingBottom: 10,
  float: 'right',
  $nest: {
    '& > label': {
      fontSize: 'var(--graph-side-panel--font-size)'
    }
  }
});

export class SummaryPanelNodeTraces extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  constructor(props: Props) {
    super(props);
    this.state = { traces: [], keepList: false };
  }

  componentDidMount() {
    this.loadTraces();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      !this.state.keepList &&
      (prevProps.queryTime !== this.props.queryTime ||
        prevProps.namespace !== this.props.namespace ||
        prevProps.service !== this.props.service)
    ) {
      this.loadTraces();
    }
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  private loadTraces() {
    // Convert seconds to microseconds
    const params: TracingQuery = {
      startMicros: this.props.queryTime * 1000000,
      limit: tracesLimit
    };
    this.promises.cancelAll();
    this.promises
      .register('traces', API.getJaegerTraces(this.props.namespace, this.props.service, params))
      .then(response => {
        const traces = response.data.data
          ? (response.data.data
              .map(trace => transformTraceData(trace))
              .filter(trace => trace !== null) as JaegerTrace[])
          : [];
        this.setState({ traces: traces });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch traces.', error);
      });
  }

  private onClickTrace(trace: JaegerTrace) {
    this.props.setTraceId(trace.traceID);
  }

  render() {
    if (this.state.traces.length === 0) {
      return null;
    }
    const tracesDetailsURL = `/namespaces/${this.props.namespace}/services/${this.props.service}?tab=traces`;

    return (
      <div style={{ marginBottom: 8 }}>
        <Tooltip content="When checked, traces won't be reloaded with Graph refresh">
          <Checkbox
            id="disable-refresh"
            label="Keep list"
            className={checkboxStyle}
            isChecked={this.state.keepList}
            onChange={checked => this.setState({ keepList: checked })}
          />
        </Tooltip>
        <SimpleList style={{ marginBottom: 8 }} aria-label="Traces list">
          {this.state.traces.map((trace, idx) => {
            return (
              <SimpleListItem key={'trace_' + idx} onClick={() => this.onClickTrace(trace)}>
                <TraceListItem trace={trace} />
              </SimpleListItem>
            );
          })}
        </SimpleList>
        <Button style={summaryFont} onClick={() => history.push(tracesDetailsURL)}>
          Find more traces
        </Button>
      </div>
    );
  }
}
