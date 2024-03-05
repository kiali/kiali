import * as React from 'react';
import { Card, CardBody, Tab, Tabs, Toolbar, ToolbarGroup, ToolbarItem, Tooltip } from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';
import * as API from 'services/Api';
import * as AlertUtils from 'utils/AlertUtils';
import { RenderComponentScroll } from '../Nav/Page';
import { KioskElement } from '../Kiosk/KioskElement';
import { TimeDurationModal } from '../Time/TimeDurationModal';
import { KialiAppState } from 'store/Store';
import { TracingError, JaegerTrace } from 'types/TracingInfo';
import { TraceDetails } from './TracingResults/TraceDetails';
import { TracingScatter } from './TracingScatter';
import { TracesFetcher, FetchOptions } from './TracesFetcher';
import { SpanDetails } from './TracingResults/SpanDetails';
import { isEqualTimeRange, TargetKind, TimeInMilliseconds, TimeRange } from 'types/Common';
import { timeRangeSelector } from 'store/Selectors';
import { getTimeRangeMicros } from 'utils/tracing/TracingHelper';
import { TracesDisplayOptions, QuerySettings, DisplaySettings, percentilesOptions } from './TracesDisplayOptions';
import { Direction, genStatsKey, MetricsStatsQuery } from 'types/MetricsOptions';
import { MetricsStatsResult } from 'types/Metrics';
import { getSpanId } from 'utils/SearchParamUtils';
import { TimeDurationIndicator } from '../Time/TimeDurationIndicator';
import { subTabStyle } from 'styles/TabStyles';
import { TEMPO } from 'types/Tracing';
import { ExternalServiceInfo } from '../../types/StatusState';

type ReduxProps = {
  externalServices: ExternalServiceInfo[];
  namespaceSelector: boolean;
  provider?: string;
  selectedTrace?: JaegerTrace;
  timeRange: TimeRange;
  urlTracing: string;
};

type TracesProps = ReduxProps & {
  cluster?: string;
  lastRefreshAt: TimeInMilliseconds;
  namespace: string;
  target: string;
  targetKind: TargetKind;
};

interface TracesState {
  activeTab: number;
  displaySettings: DisplaySettings;
  isTimeOptionsOpen: boolean;
  querySettings: QuerySettings;
  targetApp?: string;
  toolbarDisabled: boolean;
  traces: JaegerTrace[];
  tracingErrors: TracingError[];
  url: string;
  width: number;
}

const traceDetailsTab = 0;
const spansDetailsTab = 1;

function GetGrafanaUrl(externalServices: ExternalServiceInfo[]): ExternalServiceInfo | undefined {
  return externalServices.find(service => service.name === 'Grafana');
}

function GetBaseTracingUrl(
  provider: string | undefined,
  urlTracing: string | undefined,
  externalServices: ExternalServiceInfo[]
): string | undefined {
  return provider === TEMPO ? GetGrafanaUrl(externalServices)?.url : urlTracing;
}

export function GetTraceDetailURL(
  provider: string | undefined,
  urlTracing: string | undefined,
  externalServices: ExternalServiceInfo[]
): string | undefined {
  const tracingUrl = GetBaseTracingUrl(provider, urlTracing, externalServices);
  if (!tracingUrl) {
    return undefined;
  }
  return provider === TEMPO
    ? `${tracingUrl}/explore?left={"queries":[{"datasource":{"type":"tempo"},"queryType":"traceql","query":"TRACEID"}]}`
    : `${tracingUrl}/trace/TRACEID`;
}

export function GetTracingURL(externalServices: ExternalServiceInfo[]): string | undefined {
  const grafanaService = externalServices.find(service => service.name === 'Grafana');
  const jaegerService = externalServices.find(service => service.name === 'jaeger');
  const tempoService = externalServices.find(service => service.name === TEMPO);

  if (tempoService) {
    const tracingUrl = grafanaService?.url;
    return tracingUrl
      ? `${tracingUrl}/explore?left={"queries":[{"datasource":{"type":"tempo"},"queryType":"nativeSearch"}]}`
      : undefined;
  }

  return jaegerService?.url;
}

class TracesComp extends React.Component<TracesProps, TracesState> {
  private fetcher: TracesFetcher;
  private percentilesPromise: Promise<Map<string, number>>;

  constructor(props: TracesProps) {
    super(props);
    let targetApp: string | undefined = undefined;
    if (this.props.targetKind === 'app') {
      targetApp = this.props.namespaceSelector ? `${this.props.target}.${this.props.namespace}` : this.props.target;
    }
    this.state = {
      isTimeOptionsOpen: false,
      url: '',
      width: 0,
      querySettings: TracesDisplayOptions.retrieveQuerySettings(),
      displaySettings: TracesDisplayOptions.retrieveDisplaySettings(),
      traces: [],
      tracingErrors: [],
      targetApp: targetApp,
      activeTab: getSpanId() ? spansDetailsTab : traceDetailsTab,
      toolbarDisabled: false
    };
    this.fetcher = new TracesFetcher(this.onTracesUpdated, errors => {
      // If there was traces displayed already, do not hide them so that the user can still interact with them
      // (consider it's probably a temporary failure)
      // Note that the error message is anyway displayed in the notifications component, so it's not going unnoticed
      if (this.state.traces.length === 0) {
        this.setState({ tracingErrors: errors, toolbarDisabled: true });
      }
    });
    // This establishes the percentile-based filtering levels
    this.percentilesPromise = this.fetchPercentiles();
  }

  componentDidMount(): void {
    this.fetchTraces();
  }

  componentDidUpdate(prevProps: TracesProps): void {
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

  private getTags = (): string => {
    return this.state.querySettings.errorsOnly ? '{"error":"true"}' : '';
  };

  private fetchTraces = async (): Promise<void> => {
    const options: FetchOptions = {
      namespace: this.props.namespace,
      cluster: this.props.cluster,
      target: this.props.target,
      targetKind: this.props.targetKind,
      spanLimit: this.state.querySettings.limit,
      tags: this.getTags()
    };
    // If percentil filter is set fetch only traces above the specified percentile
    // Percentiles (99th, 90th, 75th) are pre-computed from metrics bound to this app/workload/service object.
    if (this.state.querySettings.percentile && this.state.querySettings.percentile !== 'all') {
      try {
        const percentiles = await this.percentilesPromise;
        options.minDuration = percentiles.get(this.state.querySettings.percentile);
        if (!options.minDuration) {
          AlertUtils.addWarning('Cannot perform query above the requested percentile (value unknown).');
        }
      } catch (err) {
        AlertUtils.addError(`Could not fetch percentiles: ${err}`);
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
        kind: this.props.targetKind,
        cluster: this.props.cluster
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

  private onTracesUpdated = (traces: JaegerTrace[], tracingServiceName: string): void => {
    const newState: Partial<TracesState> = { traces: traces, tracingErrors: undefined, toolbarDisabled: false };
    if (this.state.targetApp === undefined && tracingServiceName) {
      newState.targetApp = tracingServiceName;
    }
    this.setState(newState as TracesState);
  };

  private getTracingUrl = (): undefined | string => {
    const tracingUrl = GetBaseTracingUrl(this.props.provider, this.props.urlTracing, this.props.externalServices);

    if (tracingUrl === '' || !tracingUrl || !this.state.targetApp) {
      return undefined;
    }
    const range = getTimeRangeMicros();

    if (this.props.provider === TEMPO) {
      return `${tracingUrl}/explore?left={"queries":[{"datasource":{"type":"tempo"},"queryType":"nativeSearch","serviceName":"${this.state.targetApp}"}]}`;
    }

    let url = `${tracingUrl}/search?service=${this.state.targetApp}&start=${range.from}&limit=${this.state.querySettings.limit}`;
    if (range.to) {
      url += `&end=${range.to}`;
    }
    const tags = this.getTags();
    if (tags) {
      url += `&tags=${tags}`;
    }
    return url;
  };

  private onQuerySettingsChanged = (settings: QuerySettings): void => {
    this.fetcher.resetLastFetchTime();
    this.setState({ querySettings: settings }, this.fetchTraces);
  };

  private onDisplaySettingsChanged = (settings: DisplaySettings): void => {
    this.setState({ displaySettings: settings });
  };

  private toggleTimeOptionsVisibility = (): void => {
    this.setState(prevState => ({ isTimeOptionsOpen: !prevState.isTimeOptionsOpen }));
  };

  render(): React.ReactElement {
    const tracingURL = this.getTracingUrl();
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
                  <ToolbarItem style={{ marginLeft: 'auto' }}>
                    {/*Blank item used as a separator do shift the following ToolbarItems to the right*/}
                  </ToolbarItem>
                  {tracingURL && (
                    <ToolbarItem>
                      <Tooltip content={<>Open Chart in {this.props.provider} UI</>}>
                        <a
                          href={tracingURL}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ marginLeft: '10px' }}
                          data-test="view-in-tracing"
                        >
                          View in Tracing <ExternalLinkAltIcon />
                        </a>
                      </Tooltip>
                    </ToolbarItem>
                  )}
                  <KioskElement>
                    <ToolbarItem>
                      <TimeDurationIndicator onClick={this.toggleTimeOptionsVisibility} />
                    </ToolbarItem>
                  </KioskElement>
                </ToolbarGroup>
              </Toolbar>
              <TracingScatter
                showSpansAverage={this.state.displaySettings.showSpansAverage}
                traces={this.state.traces}
                errorFetchTraces={this.state.tracingErrors}
                errorTraces={true}
                cluster={this.props.cluster ? this.props.cluster : ''} // TODO: Test single cluster
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
                className={subTabStyle}
                activeKey={this.state.activeTab}
                onSelect={(_, idx: any) => this.setState({ activeTab: idx })}
              >
                <Tab eventKey={traceDetailsTab} title="Trace Details">
                  <TraceDetails
                    namespace={this.props.namespace}
                    target={this.props.target}
                    targetKind={this.props.targetKind}
                    tracingURL={GetTraceDetailURL(
                      this.props.provider,
                      this.props.urlTracing,
                      this.props.externalServices
                    )}
                    otherTraces={this.state.traces}
                    cluster={this.props.cluster ? this.props.cluster : ''}
                    provider={this.props.provider}
                  />
                </Tab>
                <Tab eventKey={spansDetailsTab} title="Span Details">
                  <SpanDetails
                    namespace={this.props.namespace}
                    target={this.props.target}
                    externalURL={GetTraceDetailURL(
                      this.props.provider,
                      this.props.urlTracing,
                      this.props.externalServices
                    )}
                    items={this.props.selectedTrace.spans}
                    traceID={this.props.selectedTrace.traceID}
                    cluster={this.props.cluster ? this.props.cluster : ''}
                  />
                </Tab>
              </Tabs>
            </div>
          )}
        </RenderComponentScroll>
        <TimeDurationModal
          customDuration={true}
          isOpen={this.state.isTimeOptionsOpen}
          onConfirm={this.toggleTimeOptionsVisibility}
          onCancel={this.toggleTimeOptionsVisibility}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): ReduxProps => {
  return {
    externalServices: state.statusState.externalServices,
    namespaceSelector: state.tracingState.info ? state.tracingState.info.namespaceSelector : true,
    provider: state.tracingState.info?.provider,
    selectedTrace: state.tracingState.selectedTrace,
    timeRange: timeRangeSelector(state),
    urlTracing: state.tracingState.info ? state.tracingState.info.url : ''
  };
};

export const TracesComponent = connect(mapStateToProps)(TracesComp);
