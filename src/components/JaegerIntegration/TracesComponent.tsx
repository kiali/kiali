import * as React from 'react';
import {
  Card,
  CardBody,
  Checkbox,
  Grid,
  GridItem,
  Tab,
  Tabs,
  Text,
  TextVariants,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';

import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import { RenderComponentScroll, RenderHeader } from '../Nav/Page';
import { KialiAppState } from '../../store/Store';
import { JaegerError, JaegerTrace } from '../../types/JaegerInfo';
import TraceDetails from './JaegerResults/TraceDetails';
import JaegerScatter from './JaegerScatter';
import { HistoryManager, URLParam } from '../../app/History';
import { config } from '../../config';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import RefreshContainer from 'components/Refresh/Refresh';
import { RightActionBar } from 'components/RightActionBar/RightActionBar';
import { TracesFetcher } from './TracesFetcher';
import { getTimeRangeMicros, buildTags } from './JaegerHelper';
import SpanDetails from './JaegerResults/SpanDetails';

interface TracesProps {
  namespace: string;
  target: string;
  targetKind: 'app' | 'workload' | 'service';
  urlJaeger: string;
  namespaceSelector: boolean;
  showErrors: boolean;
  duration: number;
  selectedTrace?: JaegerTrace;
}

type IntervalScale = 1 | 1000 | 1000000;
type IntervalDuration = {
  min: number;
  max: number;
  scale: IntervalScale;
  key: string;
  display: string;
};
const intervalToDisplay = (min: number, max: number, scale: IntervalScale) =>
  `${min}-${max} ${scale === 1 ? 'µs' : scale === 1000 ? 'ms' : 's'}`;
const intervalToKey = (min: number, max: number, scale: IntervalScale) => `${min}-${max}-${scale}`;
const intervalFromKey = (key: string): IntervalDuration | undefined => {
  const parts = key.split('-');
  if (parts.length !== 3) {
    return undefined;
  }
  const min = Number(parts[0]);
  const max = Number(parts[1]);
  const scale = Number(parts[2]) as IntervalScale;
  return {
    min: min,
    max: max,
    scale: scale,
    key: key,
    display: intervalToDisplay(min, max, scale)
  };
};

interface TracesState {
  url: string;
  width: number;
  showErrors: boolean;
  adjustTime: boolean;
  intervalDurations: IntervalDuration[];
  selectedIntervalDuration?: IntervalDuration;
  selectedStatusCode: string;
  selectedLimitSpans: string;
  traces: JaegerTrace[];
  jaegerErrors: JaegerError[];
  targetApp?: string;
  activeTab: number;
}

const traceDetailsTab = 0;
const spansDetailsTab = 1;

class TracesComponent extends React.Component<TracesProps, TracesState> {
  private fetcher: TracesFetcher;

  constructor(props: TracesProps) {
    super(props);
    const limit =
      HistoryManager.getParam(URLParam.JAEGER_LIMIT_TRACES) ||
      sessionStorage.getItem(URLParam.JAEGER_LIMIT_TRACES) ||
      '20';
    this.saveValue(URLParam.JAEGER_LIMIT_TRACES, limit);
    const statusCode =
      HistoryManager.getParam(URLParam.JAEGER_STATUS_CODE) ||
      sessionStorage.getItem(URLParam.JAEGER_STATUS_CODE) ||
      'none';
    const interval =
      HistoryManager.getParam(URLParam.JAEGER_TRACE_INTERVAL_SELECTED) ||
      sessionStorage.getItem(URLParam.JAEGER_TRACE_INTERVAL_SELECTED);

    let targetApp: string | undefined = undefined;
    if (this.props.targetKind === 'app') {
      targetApp = this.props.namespaceSelector ? this.props.target + '.' + this.props.namespace : this.props.target;
    }
    this.state = {
      url: '',
      width: 0,
      adjustTime: false,
      showErrors: this.props.showErrors,
      intervalDurations: [],
      selectedIntervalDuration: interval ? intervalFromKey(interval) : undefined,
      selectedStatusCode: statusCode,
      selectedLimitSpans: limit,
      traces: [],
      jaegerErrors: [],
      targetApp: targetApp,
      activeTab: traceDetailsTab
    };
    this.fetcher = new TracesFetcher(this.onTracesUpdated, errors => this.setState({ jaegerErrors: errors }));
  }

  componentDidMount() {
    this.refresh();
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
  }

  private refresh = () => {
    this.fetcher.fetch(
      {
        namespace: this.props.namespace,
        target: this.props.target,
        targetKind: this.props.targetKind,
        spanLimit: Number(this.state.selectedLimitSpans),
        tags: buildTags(this.state.showErrors, this.state.selectedStatusCode)
      },
      this.state.traces
    );
  };

  private onTracesUpdated = (traces: JaegerTrace[], jaegerServiceName: string) => {
    const durations = this.extractIntervalDurations(traces);
    const newState: Partial<TracesState> = {
      traces: traces,
      intervalDurations: durations
    };
    if (this.state.targetApp === undefined && jaegerServiceName) {
      newState.targetApp = jaegerServiceName;
    }
    this.setState(newState as TracesState);
  };

  private setErrorTraces = (value: string) => {
    this.fetcher.resetLastFetchTime();
    this.setState({ showErrors: value === 'Error traces' }, this.refresh);
  };

  private saveValue = (key: URLParam, value: string) => {
    sessionStorage.setItem(key, value);
    HistoryManager.setParam(key, value);
  };

  private removeValue = (key: URLParam) => {
    sessionStorage.removeItem(key);
    HistoryManager.deleteParam(key);
  };

  private getJaegerUrl = () => {
    if (this.props.urlJaeger === '' || !this.state.targetApp) {
      return undefined;
    }

    const range = getTimeRangeMicros();
    let url = `${this.props.urlJaeger}/search?service=${this.state.targetApp}&start=${range.from}&limit=${this.state.selectedLimitSpans}`;
    if (range.to) {
      url += `&end=${range.to}`;
    }
    const tags = buildTags(this.state.showErrors, this.state.selectedStatusCode);
    if (tags) {
      url += `&tags=${tags}`;
    }
    return url;
  };

  private handleStatusCode = (value: string) => {
    this.fetcher.resetLastFetchTime();
    this.saveValue(URLParam.JAEGER_STATUS_CODE, value);
    this.setState({ selectedStatusCode: value }, this.refresh);
  };

  private handleIntervalDuration = (key: string) => {
    const interval = this.state.intervalDurations.find(i => i.key === key);
    if (interval) {
      this.saveValue(URLParam.JAEGER_TRACE_INTERVAL_SELECTED, key);
    } else {
      this.removeValue(URLParam.JAEGER_TRACE_INTERVAL_SELECTED);
    }
    this.setState({ selectedIntervalDuration: interval });
  };

  private handleLimit = (value: string) => {
    this.fetcher.resetLastFetchTime();
    if (value) {
      this.saveValue(URLParam.JAEGER_LIMIT_TRACES, value);
    } else {
      this.removeValue(URLParam.JAEGER_LIMIT_TRACES);
    }
    this.setState({ selectedLimitSpans: value }, this.refresh);
  };

  private extractIntervalDurations = (traces: JaegerTrace[]): IntervalDuration[] => {
    const maxDuration = Math.max(...traces.map(trace => trace.duration));
    const scale = getScale(maxDuration);
    const maxDurationScaled = maxDuration / scale;
    const stepSize = Math.ceil(maxDurationScaled / 5);
    const intervals: IntervalDuration[] = [];
    for (let from = 0; from <= maxDurationScaled; from += stepSize) {
      const to = from + stepSize;
      intervals.push({
        min: from,
        max: to,
        scale: scale,
        key: intervalToKey(from, to, scale),
        display: intervalToDisplay(from, to, scale)
      });
    }
    return intervals;
  };

  private filterTraces = (): JaegerTrace[] => {
    if (!this.state.selectedIntervalDuration) {
      return this.state.traces;
    }
    const min = this.state.selectedIntervalDuration.min * this.state.selectedIntervalDuration.scale;
    const max = this.state.selectedIntervalDuration.max * this.state.selectedIntervalDuration.scale;
    return this.state.traces.filter(trace => trace.duration >= min && trace.duration <= max);
  };

  render() {
    const jaegerURL = this.getJaegerUrl();
    const intervalDurationOptions: object = { none: 'none' };
    this.state.intervalDurations.forEach(interval => {
      intervalDurationOptions[interval.key] = interval.display;
    });
    // if the selected duration isn't valid anymore, add it back to the list to not loose user settings
    if (this.state.selectedIntervalDuration && !intervalDurationOptions[this.state.selectedIntervalDuration.key]) {
      intervalDurationOptions[this.state.selectedIntervalDuration.key] = this.state.selectedIntervalDuration.display;
    }
    const selectedIntervalValue = this.state.selectedIntervalDuration
      ? intervalDurationOptions[this.state.selectedIntervalDuration.key]
      : 'none';
    return (
      <>
        {this.renderActions()}
        <RenderComponentScroll>
          <Grid style={{ padding: '10px' }} gutter="md">
            <GridItem span={12}>
              <Card>
                <CardBody>
                  <RenderHeader>
                    <Toolbar>
                      <ToolbarGroup>
                        <ToolbarItem>
                          <Text
                            component={TextVariants.h5}
                            style={{ display: '-webkit-inline-box', marginRight: '10px' }}
                          >
                            Interval Trace
                          </Text>
                          <ToolbarDropdown
                            options={intervalDurationOptions}
                            value={selectedIntervalValue}
                            handleSelect={key => this.handleIntervalDuration(key)}
                          />
                        </ToolbarItem>
                      </ToolbarGroup>
                      <ToolbarGroup>
                        <ToolbarItem>
                          <Text
                            component={TextVariants.h5}
                            style={{ display: '-webkit-inline-box', marginRight: '10px' }}
                          >
                            Limit Results
                          </Text>
                          <ToolbarDropdown
                            options={config.tracing.configuration.limitResults}
                            value={config.tracing.configuration.limitResults[this.state.selectedLimitSpans]}
                            handleSelect={key => this.handleLimit(key)}
                          />
                        </ToolbarItem>
                      </ToolbarGroup>
                      <ToolbarGroup>
                        <ToolbarItem>
                          <Text
                            component={TextVariants.h5}
                            style={{ display: '-webkit-inline-box', marginRight: '10px' }}
                          >
                            Status Code
                          </Text>
                          <ToolbarDropdown
                            options={config.tracing.configuration.statusCode}
                            value={config.tracing.configuration.statusCode[this.state.selectedStatusCode]}
                            handleSelect={key => this.handleStatusCode(key)}
                          />
                        </ToolbarItem>
                      </ToolbarGroup>
                      <ToolbarGroup>
                        <ToolbarItem>
                          <Text
                            component={TextVariants.h5}
                            style={{ display: '-webkit-inline-box', marginRight: '10px' }}
                          >
                            Display
                          </Text>
                          <ToolbarDropdown
                            options={{ 'All traces': 'All traces', 'Error traces': 'Error traces' }}
                            value={this.state.showErrors ? 'Error traces' : 'All traces'}
                            handleSelect={key => this.setErrorTraces(key)}
                          />
                        </ToolbarItem>
                      </ToolbarGroup>
                      <ToolbarGroup>
                        <ToolbarItem>
                          <Checkbox
                            label="Adjust time"
                            isChecked={this.state.adjustTime}
                            onChange={checked => {
                              this.setState({ adjustTime: checked });
                            }}
                            aria-label="adjust-time-chart"
                            id="check-adjust-time"
                            name="check-adjust-time"
                          />
                        </ToolbarItem>
                      </ToolbarGroup>
                      {jaegerURL && (
                        <ToolbarGroup style={{ marginLeft: 'auto' }}>
                          <ToolbarItem>
                            <Tooltip content={<>Open Chart in Jaeger UI</>}>
                              <a
                                href={jaegerURL}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ marginLeft: '10px' }}
                              >
                                View in Tracing <ExternalLinkAltIcon />
                              </a>
                            </Tooltip>
                          </ToolbarItem>
                        </ToolbarGroup>
                      )}
                    </Toolbar>
                  </RenderHeader>
                  <JaegerScatter
                    fixedTime={!this.state.adjustTime}
                    traces={this.filterTraces()}
                    errorFetchTraces={this.state.jaegerErrors}
                    errorTraces={true}
                  />
                </CardBody>
              </Card>
            </GridItem>
            {this.props.selectedTrace && (
              <GridItem span={12}>
                <Tabs
                  id="trace-details"
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
                  <Tab eventKey={spansDetailsTab} title="Spans Details">
                    <SpanDetails
                      namespace={this.props.namespace}
                      target={this.props.target}
                      externalURL={this.props.urlJaeger}
                    />
                  </Tab>
                </Tabs>
              </GridItem>
            )}
          </Grid>
        </RenderComponentScroll>
      </>
    );
  }

  private renderActions = (): JSX.Element => {
    return (
      <RightActionBar>
        <TimeRangeComponent onChanged={this.refresh} allowCustom={false} tooltip={'Time range'} />
        <RefreshContainer id="traces-refresh" handleRefresh={this.refresh} hideLabel={true} />
      </RightActionBar>
    );
  };
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    urlJaeger: state.jaegerState.info ? state.jaegerState.info.url : '',
    namespaceSelector: state.jaegerState.info ? state.jaegerState.info.namespaceSelector : true,
    selectedTrace: state.jaegerState.selectedTrace
  };
};

const getScale = (n: number): IntervalScale => {
  return Math.min(1000000, n >= 1000 ? 1000 * getScale(n / 1000) : 1) as IntervalScale;
};

export const TracesContainer = connect(mapStateToProps)(TracesComponent);

export default TracesContainer;
