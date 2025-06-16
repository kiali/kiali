import * as React from 'react';
import { connect } from 'react-redux';
import { SimpleList, SimpleListItem, Button, Divider, ButtonVariant } from '@patternfly/react-core';
import { kialiStyle } from 'styles/StyleUtils';

import { KialiAppState } from 'store/Store';
import { TracingThunkActions } from 'actions/TracingThunkActions';
import { router, URLParam } from '../../app/History';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { JaegerTrace, TracingResponse } from 'types/TracingInfo';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { TracingQuery } from 'types/Tracing';
import { TimeInSeconds } from 'types/Common';
import { TraceListItem } from 'components/TracingIntegration/TraceListItem';
import { summaryFont } from './SummaryPanelCommon';
import { DecoratedGraphNodeData } from 'types/Graph';
import { transformTraceData } from 'utils/tracing/TraceTransform';
import { isParentKiosk, kioskContextMenuAction } from '../../components/Kiosk/KioskActions';
import { KialiDispatch } from '../../types/Redux';
import { isMultiCluster } from '../../config';
import { KialiIcon } from 'config/KialiIcon';
import { TraceLimit, TraceLimitOption } from 'components/Metrics/TraceLimit';
import { endPerfTimer, startPerfTimer } from '../../utils/PerformanceUtils';
import { ApiResponse } from '../../types/Api';

type ReduxStateProps = {
  kiosk: string;
  selectedTrace?: JaegerTrace;
};

type ReduxDispatchProps = {
  setTraceId: (cluster?: string, traceId?: string) => void;
};

type Props = ReduxStateProps &
  ReduxDispatchProps & {
    nodeData: DecoratedGraphNodeData;
    queryTime: TimeInSeconds;
  };

type State = {
  traces: JaegerTrace[];
};

const refreshDivStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  width: '100%',
  marginTop: '0.5rem',
  marginBottom: '0.5rem'
});

const refreshButtonStyle = kialiStyle({
  padding: '0.125rem 0.5rem',
  marginLeft: 'auto'
});

const dividerStyle = kialiStyle({
  paddingBottom: '0.25rem'
});

class SummaryPanelNodeTracesComponent extends React.Component<Props, State> {
  private promises = new PromisesRegistry();
  private currentLimit: TraceLimitOption = 20;

  static getDerivedStateFromProps(props: Props, state: State): State {
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
    this.state = { traces: [] };
  }

  componentDidMount(): void {
    this.loadTraces();
  }

  componentDidUpdate(prevProps: Props): void {
    if (
      prevProps.nodeData.namespace !== this.props.nodeData.namespace ||
      prevProps.nodeData.app !== this.props.nodeData.app ||
      prevProps.nodeData.workload !== this.props.nodeData.workload ||
      prevProps.nodeData.service !== this.props.nodeData.service
    ) {
      this.loadTraces();
    }
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  render(): React.ReactNode {
    const d = this.props.nodeData;

    const tracesDetailsURL = `/namespaces/${d.namespace}${
      d.workload ? `/workloads/${d.workload}` : d.service ? `/services/${d.service}` : `/applications/${d.app!}`
    }?tab=traces${d.cluster && isMultiCluster ? `&${URLParam.CLUSTERNAME}=${encodeURIComponent(d.cluster)}` : ''}`;

    const currentID = this.props.selectedTrace?.traceID;

    return (
      <div style={{ marginBottom: '0.5rem' }}>
        <div className={refreshDivStyle}>
          <span style={{ marginLeft: '0.5rem' }}>
            <TraceLimit initialLimit={this.currentLimit} onLimitChange={this.onLimitChange} />
          </span>

          <Button
            id="manual-refresh"
            onClick={() => this.loadTraces()}
            aria-label="Refresh"
            variant={ButtonVariant.secondary}
            className={refreshButtonStyle}
          >
            <KialiIcon.Sync />
          </Button>
        </div>

        <Divider className={dividerStyle} />

        {this.state.traces.length > 0 && (
          <SimpleList style={{ marginBottom: '0.5rem' }} aria-label="Traces list" data-test="traces-list">
            {this.state.traces.map(trace => {
              return (
                <SimpleListItem
                  key={`trace_${trace.traceID}`}
                  onClick={() => this.onClickTrace(trace)}
                  isActive={trace.traceID === currentID}
                >
                  <TraceListItem trace={trace} />
                </SimpleListItem>
              );
            })}
          </SimpleList>
        )}

        <Button
          style={summaryFont}
          data-test="show-traces"
          onClick={() => {
            if (isParentKiosk(this.props.kiosk)) {
              kioskContextMenuAction(tracesDetailsURL);
            } else {
              router.navigate(tracesDetailsURL);
            }
          }}
        >
          Show Traces
        </Button>
      </div>
    );
  }

  private onLimitChange = (limit: number): void => {
    this.currentLimit = limit as TraceLimitOption;
    this.loadTraces();
  };

  private loadTraces(): void {
    // Convert seconds to microseconds
    const params: TracingQuery = {
      startMicros: this.props.queryTime * 1000000,
      limit: this.currentLimit
    };

    const d = this.props.nodeData;
    let perfKey: string;
    let promise: Promise<ApiResponse<TracingResponse>>;
    if (d.workload) {
      perfKey = 'WorkloadTraces';
      promise = API.getWorkloadTraces(d.namespace, d.workload, params, d.cluster);
    } else if (d.service) {
      perfKey = 'ServiceTraces';
      promise = API.getServiceTraces(d.namespace, d.service, params, d.cluster);
    } else {
      perfKey = 'AppTraces';
      promise = API.getAppTraces(d.namespace, d.app!, params, d.cluster);
    }

    this.promises.cancelAll();
    startPerfTimer(perfKey);
    this.promises
      .register('traces', promise)
      .then(response => {
        endPerfTimer(perfKey);
        const traces = response.data.data
          ? (response.data.data
              .map(trace => transformTraceData(trace, this.props.nodeData.cluster))
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

  private onClickTrace(trace: JaegerTrace): void {
    if (this.props.selectedTrace?.traceID === trace.traceID) {
      // Deselect
      this.props.setTraceId(this.props.nodeData.cluster, undefined);
    } else {
      this.props.setTraceId(this.props.nodeData.cluster, trace.traceID);
    }
  }
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  kiosk: state.globalState.kiosk,
  selectedTrace: state.tracingState.selectedTrace
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => ({
  setTraceId: (cluster?: string, traceId?: string) => dispatch(TracingThunkActions.setTraceId(cluster, traceId))
});

export const SummaryPanelNodeTraces = connect(mapStateToProps, mapDispatchToProps)(SummaryPanelNodeTracesComponent);
