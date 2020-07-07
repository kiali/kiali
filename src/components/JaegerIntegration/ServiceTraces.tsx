import * as React from 'react';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Grid,
  GridItem,
  Text,
  TextVariants,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';

import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import { RenderComponentScroll, RenderHeader } from '../Nav/Page';
import { KialiAppState } from '../../store/Store';
import { JaegerError, JaegerTrace } from '../../types/JaegerInfo';
import { JaegerItem, transformTraceData } from './JaegerResults';
import { JaegerScatter } from './JaegerScatter';
import { HistoryManager, URLParam } from '../../app/History';
import { config, serverConfig } from '../../config';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import RefreshContainer from 'components/Refresh/Refresh';
import { RightActionBar } from 'components/RightActionBar/RightActionBar';
import { TracesFetcher } from './TracesFetcher';
import { getTimeRangeMicros, buildTags } from './JaegerHelper';

interface ServiceTracesProps {
  namespace: string;
  service: string;
  urlJaeger: string;
  namespaceSelector: boolean;
  showErrors: boolean;
  duration: number;
}

interface ServiceTracesState {
  url: string;
  width: number;
  showErrors: boolean;
  fixedTime: boolean;
  traceIntervalDurations: { [key: string]: string };
  selectedTraceIntervalDuration: string;
  selectedStatusCode: string;
  selectedLimitSpans: string;
  traces: JaegerTrace[];
  traceId?: string;
  selectedTrace?: JaegerTrace;
  jaegerErrors: JaegerError[];
}

export const traceDurationUnits: { [key: string]: string } = {
  us: 'us',
  ms: 'ms',
  s: 's'
};

class ServiceTracesC extends React.Component<ServiceTracesProps, ServiceTracesState> {
  private fetcher: TracesFetcher;

  constructor(props: ServiceTracesProps) {
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
      sessionStorage.getItem(URLParam.JAEGER_TRACE_INTERVAL_SELECTED) ||
      'none';

    const traceId = HistoryManager.getParam(URLParam.JAEGER_TRACE_ID) || undefined;
    this.state = {
      url: '',
      width: 0,
      fixedTime: true,
      showErrors: this.props.showErrors,
      traceIntervalDurations: { none: 'none' },
      selectedTraceIntervalDuration: interval,
      selectedStatusCode: statusCode,
      selectedLimitSpans: limit,
      traces: [],
      traceId: traceId,
      jaegerErrors: []
    };
    this.fetcher = new TracesFetcher(this.onTracesUpdated, errors => this.setState({ jaegerErrors: errors }));
  }

  componentDidMount() {
    this.refresh();
    if (this.state.traceId) {
      this.fetchSingle(this.state.traceId);
    }
  }

  private refresh = () => {
    this.fetcher.fetch({
      namespace: this.props.namespace,
      service: this.props.service,
      spanLimit: Number(this.state.selectedLimitSpans),
      intervalDuration: this.state.selectedTraceIntervalDuration,
      tags: buildTags(this.state.showErrors, this.state.selectedStatusCode)
    });
  };

  private fetchSingle = (traceId: string) => {
    return API.getJaegerTrace(traceId)
      .then(response => {
        if (response.data.data) {
          const trace = transformTraceData(response.data.data);
          if (trace) {
            this.setState({ selectedTrace: trace });
          }
        }
      })
      .catch(error => AlertUtils.addError('Could not fetch trace.', error));
  };

  private onTracesUpdated = (traces: JaegerTrace[]) => {
    const durations = this.getIntervalTraceDurations(traces);
    this.setState({ traces: traces, traceIntervalDurations: durations });
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
    const service =
      this.props.namespaceSelector && serverConfig.istioNamespace !== this.props.namespace
        ? `${this.props.service}.${this.props.namespace}`
        : `${this.props.service}`;

    const range = getTimeRangeMicros();
    let url = `${this.props.urlJaeger}/search?service=${service}&start=${range.from}&limit=${this.state.selectedLimitSpans}`;
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
    if (key === 'none') {
      this.removeValue(URLParam.JAEGER_TRACE_INTERVAL_SELECTED);
    } else {
      this.saveValue(URLParam.JAEGER_TRACE_INTERVAL_SELECTED, key);
    }
    const refiltered = this.fetcher.filterTraces(key);
    this.setState({ selectedTraceIntervalDuration: key, traces: refiltered });
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

  private getIntervalTraceDurations = (traces: JaegerTrace[]) => {
    let maxDuration = Math.max.apply(
      Math,
      traces.map(trace => trace.duration)
    );
    let intervals: { [key: string]: string } = { none: 'none' };
    let i = 0;
    let unit = traceDurationUnits[Object.keys(traceDurationUnits)[i]];
    while (maxDuration >= 1000 && Object.keys(traceDurationUnits).length > i) {
      i += 1;
      maxDuration /= 1000;
      unit = traceDurationUnits[Object.keys(traceDurationUnits)[i]];
    }
    const divisions = [5, 10, 20];
    i = 0;
    while (~~(maxDuration / divisions[i]) >= 5 && divisions.length > i) {
      i += 1;
    }
    for (let step = 0; step <= maxDuration; step += divisions[i]) {
      let to = step + divisions[i] <= maxDuration ? step + divisions[i] - 1 : step + divisions[i];
      if (!Number.isNaN(to)) {
        intervals[step + '-' + to + '-' + unit] = `${step}-${to} ${unit}`;
      }
    }
    return intervals;
  };

  private onClickScatter = (traceId: string) => {
    HistoryManager.setParam(URLParam.JAEGER_TRACE_ID, traceId);
    this.fetchSingle(traceId);
  };

  render() {
    return (
      <>
        {this.renderActions()}
        <RenderComponentScroll>
          <Grid style={{ padding: '10px' }}>
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
                            options={this.state.traceIntervalDurations}
                            value={this.state.traceIntervalDurations[this.state.selectedTraceIntervalDuration]}
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
                            isChecked={this.state.fixedTime}
                            onChange={checked => {
                              this.setState({ fixedTime: checked });
                            }}
                            aria-label="adjust-time-chart"
                            id="check-adjust-time"
                            name="check-adjust-time"
                          />
                        </ToolbarItem>
                      </ToolbarGroup>
                      {this.props.urlJaeger !== '' && (
                        <ToolbarGroup style={{ marginLeft: 'auto' }}>
                          <ToolbarItem>
                            <Tooltip content={<>Open Chart in Jaeger UI</>}>
                              <Button
                                variant="link"
                                onClick={() => window.open(this.getJaegerUrl(), '_blank')}
                                style={{ marginLeft: '10px' }}
                              >
                                View in Tracing <ExternalLinkAltIcon />
                              </Button>
                            </Tooltip>
                          </ToolbarItem>
                        </ToolbarGroup>
                      )}
                    </Toolbar>
                  </RenderHeader>
                  <Grid style={{ margin: '20px' }}>
                    <GridItem span={12}>
                      <JaegerScatter
                        fixedTime={this.state.fixedTime}
                        traces={this.state.traces}
                        errorFetchTraces={this.state.jaegerErrors}
                        onClick={traceId => this.onClickScatter(traceId)}
                        errorTraces={true}
                      />
                    </GridItem>
                    <GridItem span={12}>
                      {this.state.selectedTrace && (
                        <JaegerItem
                          trace={this.state.selectedTrace}
                          namespace={this.props.namespace}
                          service={this.props.service}
                          jaegerURL={this.props.urlJaeger}
                        />
                      )}
                    </GridItem>
                  </Grid>
                </CardBody>
              </Card>
            </GridItem>
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
    namespaceSelector: state.jaegerState.info ? state.jaegerState.info.namespaceSelector : true
  };
};

export const ServiceTraces = connect(mapStateToProps)(ServiceTracesC);

export default ServiceTraces;
