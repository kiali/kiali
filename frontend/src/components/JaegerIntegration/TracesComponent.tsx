import * as React from 'react';
import { Card, CardBody, Tab, Tabs, Toolbar, ToolbarGroup, ToolbarItem, Tooltip } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';

import * as API from 'services/Api';
import * as AlertUtils from 'utils/AlertUtils';
import { RenderComponentScroll } from '../Nav/Page';
import { KialiAppState } from 'store/Store';
import { JaegerError, JaegerTrace } from 'types/JaegerInfo';
import TraceDetails from './JaegerResults/TraceDetails';
import JaegerScatter from './JaegerScatter';
import { TracesFetcher, FetchOptions } from './TracesFetcher';
import { SpanDetails } from './JaegerResults/SpanDetails';
import { isEqualTimeRange, TargetKind, TimeInMilliseconds, TimeRange } from 'types/Common';
import { timeRangeSelector } from 'store/Selectors';
import { getTimeRangeMicros } from 'utils/tracing/TracingHelper';
import { TracesDisplayOptions, QuerySettings, DisplaySettings, percentilesOptions } from './TracesDisplayOptions';
import { Direction, genStatsKey, MetricsStatsQuery } from 'types/MetricsOptions';
import { MetricsStatsResult } from 'types/Metrics';
import { getSpanId } from 'utils/SearchParamUtils';

interface TracesProps {
  namespace: string;
  target: string;
  targetKind: TargetKind;
  urlJaeger: string;
  namespaceSelector: boolean;
  timeRange: TimeRange;
  selectedTrace?: JaegerTrace;
  lastRefreshAt: TimeInMilliseconds;
}

interface TracesState {
  url: string;
  width: number;
  querySettings: QuerySettings;
  displaySettings: DisplaySettings;
  traces: JaegerTrace[];
  jaegerErrors: JaegerError[];
  targetApp?: string;
  activeTab: number;
  toolbarDisabled: boolean;
}

const traceDetailsTab = 0;
const spansDetailsTab = 1;

class TracesComponent extends React.Component<TracesProps, TracesState> {
  private fetcher: TracesFetcher;
  private percentilesPromise: Promise<Map<string, number>>;

  constructor(props: TracesProps) {
    super(props);
    let targetApp: string | undefined = undefined;
    if (this.props.targetKind === 'app') {
      targetApp = this.props.namespaceSelector ? this.props.target + '.' + this.props.namespace : this.props.target;
    }
    this.state = {
      url: '',
      width: 0,
      querySettings: TracesDisplayOptions.retrieveQuerySettings(),
      displaySettings: TracesDisplayOptions.retrieveDisplaySettings(),
      traces: [],
      jaegerErrors: [],
      targetApp: targetApp,
      activeTab: getSpanId() ? spansDetailsTab : traceDetailsTab,
      toolbarDisabled: false
    };
    this.fetcher = new TracesFetcher(this.onTracesUpdated, errors => {
      // If there was traces displayed already, do not hide them so that the user can still interact with them
      // (consider it's probably a temporary failure)
      // Note that the error message is anyway displayed in the notifications component, so it's not going unnoticed
      if (this.state.traces.length === 0) {
        this.setState({ jaegerErrors: errors, toolbarDisabled: true });
      }
    });
    this.percentilesPromise = this.fetchPercentiles();
  }

  componentDidMount() {
    this.fetchTraces();
  }

  componentDidUpdate(prevProps: TracesProps) {
    // Selected trace (coming from redux) might have been reloaded and needs to be updated within the traces list
    // Check reference of selected trace
    if (this.props.selectedTrace && prevProps.selectedTrace !== this.props.selectedTrace) {
      const traces = this.state.traces;
      const trace = this.props.selectedTrace;
      const index = traces.findIndex(t => t.traceID === trace.traceID);
      if (index >= 0) {
        traces[index] = this.props.selectedTrace;
        this.setState({ traces: traces });
      }
    }

    const changedTimeRange = !isEqualTimeRange(this.props.timeRange, prevProps.timeRange);
    if (this.props.lastRefreshAt !== prevProps.lastRefreshAt || changedTimeRange) {
      if (changedTimeRange) {
        this.fetcher.resetLastFetchTime();
      }
      this.fetchTraces();
    }
  }

  private getTags = () => {
    return this.state.querySettings.errorsOnly ? '{"error":"true"}' : '';
  };

  private fetchTraces = async () => {
    const options: FetchOptions = {
      namespace: this.props.namespace,
      target: this.props.target,
      targetKind: this.props.targetKind,
      spanLimit: this.state.querySettings.limit,
      tags: this.getTags()
    };
    if (this.state.querySettings.percentile && this.state.querySettings.percentile !== 'all') {
      // Fetching traces above a percentile
      // Percentiles (99th, 90th, 75th) are pre-computed from metrics bound to this app/workload/service object.
      try {
        const percentiles = await this.percentilesPromise;
        options.minDuration = percentiles.get(this.state.querySettings.percentile);
        if (!options.minDuration) {
          AlertUtils.addWarning('Cannot perform query above the requested percentile (value unknown).');
        }
      } catch (err) {
        AlertUtils.addError('Could not fetch percentiles.', err);
      }
    }
    this.fetcher.fetch(options, this.state.traces);
  };

  private fetchPercentiles = (): Promise<Map<string, number>> => {
    // We'll fetch percentiles on a large enough interval (unrelated to the selected interval)
    // in order to have stable values and avoid constantly fetching again
    const query: MetricsStatsQuery = {
      queryTime: Math.floor(Date.now() / 1000),
      target: {
        namespace: this.props.namespace,
        name: this.props.target,
        kind: this.props.targetKind
      },
      interval: '1h',
      direction: 'inbound',
      avg: false,
      quantiles: percentilesOptions.map(p => p.id).filter(id => id !== 'all')
    };
    const queries: MetricsStatsQuery[] =
      this.props.targetKind === 'service' ? [query] : [query, { ...query, direction: 'outbound' }];
    return API.getMetricsStats(queries).then(r => this.percentilesFetched(query, r.data));
  };

  private percentilesFetched = (q: MetricsStatsQuery, r: MetricsStatsResult): Map<string, number> => {
    if (r.warnings) {
      AlertUtils.addWarning(r.warnings.join(', '));
    }
    const [mapInbound, mapOutbound] = (['inbound', 'outbound'] as Direction[]).map(dir => {
      const map = new Map<string, number>();
      const key = genStatsKey(q.target, undefined, dir, q.interval);
      if (key) {
        const statsForKey = r.stats[key];
        if (statsForKey) {
          statsForKey.responseTimes.forEach(rt => {
            if (q.quantiles.includes(rt.name)) {
              map.set(rt.name, rt.value);
            }
          });
        }
      }
      return map;
    });
    // Merge the two maps; if a value exists in both of them, take the mean
    const minDurations = new Map<string, number>();
    mapInbound.forEach((v1, k) => {
      const v2 = mapOutbound.get(k);
      if (v2) {
        minDurations.set(k, (v1 + v2) / 2);
        mapOutbound.delete(k);
      } else {
        minDurations.set(k, v1);
      }
    });
    mapOutbound.forEach((v, k) => minDurations.set(k, v));
    return minDurations;
  };

  private onTracesUpdated = (traces: JaegerTrace[], jaegerServiceName: string) => {
    const newState: Partial<TracesState> = { traces: traces, jaegerErrors: undefined, toolbarDisabled: false };
    if (this.state.targetApp === undefined && jaegerServiceName) {
      newState.targetApp = jaegerServiceName;
    }
    this.setState(newState as TracesState);
  };

  private getJaegerUrl = () => {
    if (this.props.urlJaeger === '' || !this.state.targetApp) {
      return undefined;
    }

    const range = getTimeRangeMicros();
    let url = `${this.props.urlJaeger}/search?service=${this.state.targetApp}&start=${range.from}&limit=${this.state.querySettings.limit}`;
    if (range.to) {
      url += `&end=${range.to}`;
    }
    const tags = this.getTags();
    if (tags) {
      url += `&tags=${tags}`;
    }
    return url;
  };

  private onQuerySettingsChanged = (settings: QuerySettings) => {
    this.fetcher.resetLastFetchTime();
    this.setState({ querySettings: settings }, this.fetchTraces);
  };

  private onDisplaySettingsChanged = (settings: DisplaySettings) => {
    this.setState({ displaySettings: settings });
  };

  render() {
    const jaegerURL = this.getJaegerUrl();
    return (
      <>
        <RenderComponentScroll>
          <Card>
            <CardBody>
              <Toolbar style={{ padding: 0 }}>
                <ToolbarGroup>
                  <ToolbarItem>
                    <TracesDisplayOptions
                      onDisplaySettingsChanged={this.onDisplaySettingsChanged}
                      onQuerySettingsChanged={this.onQuerySettingsChanged}
                      percentilesPromise={this.percentilesPromise}
                      disabled={this.state.toolbarDisabled}
                    />
                  </ToolbarItem>
                </ToolbarGroup>
                {jaegerURL && (
                  <ToolbarGroup style={{ marginLeft: 'auto' }}>
                    <ToolbarItem>
                      <Tooltip content={<>Open Chart in Jaeger UI</>}>
                        <a href={jaegerURL} target="_blank" rel="noopener noreferrer" style={{ marginLeft: '10px' }}>
                          View in Tracing <ExternalLinkAltIcon />
                        </a>
                      </Tooltip>
                    </ToolbarItem>
                  </ToolbarGroup>
                )}
              </Toolbar>
              <JaegerScatter
                showSpansAverage={this.state.displaySettings.showSpansAverage}
                traces={this.state.traces}
                errorFetchTraces={this.state.jaegerErrors}
                errorTraces={true}
              />
            </CardBody>
          </Card>
          {this.props.selectedTrace && (
            <div
              style={{
                marginTop: 25
              }}
            >
              <Tabs
                id="trace-details"
                data-test="trace-details-tabs"
                activeKey={this.state.activeTab}
                onSelect={(_, idx: any) => this.setState({ activeTab: idx })}
              >
                <Tab eventKey={traceDetailsTab} title="Trace Details">
                  <TraceDetails
                    namespace={this.props.namespace}
                    target={this.props.target}
                    targetKind={this.props.targetKind}
                    jaegerURL={this.props.urlJaeger}
                    otherTraces={this.state.traces}
                  />
                </Tab>
                <Tab eventKey={spansDetailsTab} title="Span Details">
                  <SpanDetails
                    namespace={this.props.namespace}
                    target={this.props.target}
                    externalURL={this.props.urlJaeger}
                    items={this.props.selectedTrace.spans}
                  />
                </Tab>
              </Tabs>
            </div>
          )}
        </RenderComponentScroll>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    timeRange: timeRangeSelector(state),
    urlJaeger: state.jaegerState.info ? state.jaegerState.info.url : '',
    namespaceSelector: state.jaegerState.info ? state.jaegerState.info.namespaceSelector : true,
    selectedTrace: state.jaegerState.selectedTrace,
    lastRefreshAt: state.globalState.lastRefreshAt
  };
};

export const TracesContainer = connect(mapStateToProps)(TracesComponent);

export default TracesContainer;
