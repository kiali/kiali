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
import { JaegerSearchOptions, convTagsLogfmt } from './RouteHelper';
import { HistoryManager, URLParam } from '../../app/History';
import { serverConfig, config } from '../../config';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import RefreshContainer from 'components/Refresh/Refresh';
import { RightActionBar } from 'components/RightActionBar/RightActionBar';
import { TracesFetcher } from './TracesFetcher';

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
  options: JaegerSearchOptions;
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
  us: 'us', // is it µs ?
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
    this.saveValue('JAEGER_LIMIT_TRACES', limit);
    let tags = '';
    const statusCode =
      HistoryManager.getParam(URLParam.JAEGER_STATUS_CODE) ||
      sessionStorage.getItem(URLParam.JAEGER_STATUS_CODE) ||
      'none';
    if (this.props.showErrors) {
      tags += 'error=true';
    }
    if (statusCode !== 'none') {
      tags += ' http.status_code=' + statusCode;
    }
    HistoryManager.setParam(URLParam.JAEGER_TAGS, convTagsLogfmt(tags));
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
      options: {
        limit: limit,
        tags: tags
      },
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
    this.fetcher.fetch(this.props.namespace, this.props.service, this.state.selectedTraceIntervalDuration);
  };

  private fetchSingle = (traceId: string) => {
    return API.getJaegerTrace(this.props.namespace, this.props.service, traceId)
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

  private setErrorTraces = (key: string) => {
    let showErrors = false;
    let tags = this.state.options.tags || '';
    if (key === 'Error traces') {
      showErrors = true;
      tags === '' ? (tags = 'error=true') : (tags += ' error=true');
    } else {
      tags = tags.replace(/ ?error=true/, '');
    }
    this.setState({ showErrors: showErrors });
    this.onOptionsChange('JAEGER_TAGS', tags);
    this.refresh();
  };

  private saveValue = (key: string, value: string) => {
    sessionStorage.setItem(URLParam[key], value);
    HistoryManager.setParam(URLParam[key], value);
  };

  private removeValue = (key: string) => {
    sessionStorage.removeItem(URLParam[key]);
    HistoryManager.deleteParam(URLParam[key]);
  };

  private onOptionsChange = (key: string, value: string) => {
    let options = this.state.options;
    options[URLParam[key]] = value;
    value !== ''
      ? key !== 'JAEGER_TAGS'
        ? this.saveValue(key, value)
        : this.saveValue(key, convTagsLogfmt(value))
      : this.removeValue(key);
    this.setState({ options: options });
  };

  private getJaegerUrl = () => {
    const service =
      this.props.namespaceSelector && serverConfig.istioNamespace !== this.props.namespace
        ? `${this.props.service}.${this.props.namespace}`
        : `${this.props.service}`;
    const variables = [
      URLParam.JAEGER_START_TIME,
      URLParam.JAEGER_END_TIME,
      URLParam.JAEGER_TAGS,
      URLParam.JAEGER_LIMIT_TRACES
    ];
    let url = `${this.props.urlJaeger}/search?service=${service}`;
    variables.forEach(query => {
      const value = HistoryManager.getParam(query);
      if (value) {
        url += `&${query}=${value}`;
      }
    });
    return url;
  };

  private handleStatusCode = (key: string) => {
    this.setState({ selectedStatusCode: key });
    this.saveValue('JAEGER_STATUS_CODE', key);
    let tags = this.state.options.tags || '';
    if (key === 'none') {
      tags = tags.replace(/ ?http\.status_code=[0-9][0-9][0-9]/, '');
    } else {
      const new_tag = `http.status_code=${key}`;
      tags.includes('http.status_code')
        ? (tags = tags.replace(/http\.status_code=[0-9][0-9][0-9]/, new_tag))
        : tags === ''
        ? (tags = new_tag)
        : (tags += ' ' + new_tag);
    }
    this.onOptionsChange('JAEGER_TAGS', tags);
    this.refresh();
  };

  private handleIntervalDuration = (key: string) => {
    if (key === 'none') {
      this.removeValue('JAEGER_TRACE_INTERVAL_SELECTED');
    } else {
      this.saveValue('JAEGER_TRACE_INTERVAL_SELECTED', key);
    }
    const refiltered = this.fetcher.filterTraces(key);
    this.setState({ selectedTraceIntervalDuration: key, traces: refiltered });
  };

  private handleLimitDuration = (key: string) => {
    this.setState({ selectedLimitSpans: key });
    this.onOptionsChange('JAEGER_LIMIT_TRACES', key);
    this.refresh();
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
                            handleSelect={key => this.handleLimitDuration(key)}
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
    urlJaeger: state.jaegerState ? state.jaegerState.url : '',
    namespaceSelector: state.jaegerState ? state.jaegerState.namespaceSelector : true
  };
};

export const ServiceTraces = connect(mapStateToProps)(ServiceTracesC);

export default ServiceTraces;
