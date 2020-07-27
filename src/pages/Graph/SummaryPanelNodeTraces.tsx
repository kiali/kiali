import * as React from 'react';
import { connect } from 'react-redux';
import { ThunkDispatch } from 'redux-thunk';
import { SimpleList, SimpleListItem, Button, Checkbox } from '@patternfly/react-core';
import { SyncAltIcon } from '@patternfly/react-icons';
import { style } from 'typestyle';

import { KialiAppState } from 'store/Store';
import { KialiAppAction } from 'actions/KialiAppAction';
import { JaegerThunkActions } from 'actions/JaegerThunkActions';
import history from '../../app/History';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { JaegerTrace } from 'types/JaegerInfo';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { TracingQuery } from 'types/Tracing';
import { TimeInSeconds } from 'types/Common';
import { transformTraceData } from 'components/JaegerIntegration/JaegerResults';
import { TraceListItem } from 'components/JaegerIntegration/TraceListItem';
import { summaryFont } from './SummaryPanelCommon';

type Props = {
  namespace: string;
  service: string;
  queryTime: TimeInSeconds;
  setTraceId: (traceId?: string) => void;
  selectedTrace?: JaegerTrace;
};

type State = {
  traces: JaegerTrace[];
  useGraphRefresh: boolean;
};

const tracesLimit = 15;

const refreshDivStyle = style({
  display: 'inline-flex'
});

const checkboxStyle = style({
  paddingBottom: 10,
  marginRight: 15,
  $nest: {
    '& > label': {
      fontSize: 'var(--graph-side-panel--font-size)'
    }
  }
});

const refreshButtonStyle = style({
  padding: '2px 10px',
  marginLeft: 5,
  top: -4
});

class SummaryPanelNodeTraces extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  static getDerivedStateFromProps(props: Props, state: State) {
    // Update the selected trace within list because it may have more up-to-date data after being selected hence fetched again
    if (props.selectedTrace) {
      const index = state.traces.findIndex(t => t.traceID === props.selectedTrace!.traceID);
      if (index >= 0) {
        state.traces[index] = props.selectedTrace;
      }
    }
    return state;
  }

  constructor(props: Props) {
    super(props);
    this.state = { traces: [], useGraphRefresh: true };
  }

  componentDidMount() {
    this.loadTraces();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.state.useGraphRefresh &&
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
        if (this.props.selectedTrace && !traces.some(t => t.traceID === this.props.selectedTrace!.traceID)) {
          // Put selected trace back in list
          traces.push(this.props.selectedTrace);
        }
        this.setState({ traces: traces });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch traces.', error);
      });
  }

  private onClickTrace(trace: JaegerTrace) {
    if (this.props.selectedTrace?.traceID === trace.traceID) {
      // Deselect
      this.props.setTraceId(undefined);
    } else {
      this.props.setTraceId(trace.traceID);
    }
  }

  render() {
    if (this.state.traces.length === 0) {
      return null;
    }
    const tracesDetailsURL = `/namespaces/${this.props.namespace}/services/${this.props.service}?tab=traces`;
    const currentID = this.props.selectedTrace?.traceID;

    return (
      <div style={{ marginBottom: 8 }}>
        <div className={refreshDivStyle}>
          <Checkbox
            id="use-graph-refresh"
            label="Use graph refresh"
            className={checkboxStyle}
            isChecked={this.state.useGraphRefresh}
            onChange={checked => this.setState({ useGraphRefresh: checked })}
          />
          <Button
            id="manual-refresh"
            isDisabled={this.state.useGraphRefresh}
            onClick={() => this.loadTraces()}
            aria-label="Action"
            variant="secondary"
            className={refreshButtonStyle}
          >
            <SyncAltIcon />
          </Button>
        </div>
        <SimpleList style={{ marginBottom: 8 }} aria-label="Traces list">
          {this.state.traces.map(trace => {
            return (
              <SimpleListItem
                key={'trace_' + trace.traceID}
                onClick={() => this.onClickTrace(trace)}
                isCurrent={trace.traceID === currentID}
              >
                <TraceListItem trace={trace} />
              </SimpleListItem>
            );
          })}
        </SimpleList>
        <Button style={summaryFont} onClick={() => history.push(tracesDetailsURL)}>
          Go to Tracing
        </Button>
      </div>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  selectedTrace: state.jaegerState.selectedTrace
});

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => ({
  setTraceId: (traceId?: string) => dispatch(JaegerThunkActions.fetchTrace(traceId))
});

const SummaryPanelNodeTracesContainer = connect(mapStateToProps, mapDispatchToProps)(SummaryPanelNodeTraces);
export default SummaryPanelNodeTracesContainer;
