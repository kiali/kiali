import * as React from 'react';
import { RenderComponentScroll, RenderHeader } from '../../components/Nav/Page';
import ToolbarDropdown from '../../components/ToolbarDropdown/ToolbarDropdown';
import { Button, Card, CardBody, Checkbox, Grid, GridItem, Text, TextVariants, Tooltip } from '@patternfly/react-core';
import { KialiAppState } from '../../store/Store';
import { connect } from 'react-redux';
import { JaegerErrors, JaegerTrace } from '../../types/JaegerInfo';
import { JaegerItem } from '../../components/JaegerIntegration/JaegerResults';
import { JaegerScatter } from '../../components/JaegerIntegration/JaegerScatter';
import { PfColors } from '../../components/Pf/PfColors';
import { JaegerSearchOptions, convTagsLogfmt } from '../../components/JaegerIntegration/RouteHelper';
import { HistoryManager, URLParam } from '../../app/History';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { serverConfig, config } from '../../config';

interface ServiceTracesProps {
  namespace: string;
  service: string;
  urlJaeger: string;
  namespaceSelector: boolean;
  errorTags?: boolean;
  duration: number;
  traces: JaegerTrace[];
  errorTraces?: JaegerErrors[];
  selectedTrace?: JaegerTrace;
  selectedErrorTrace?: JaegerErrors[];
  onRefresh: (clean?: boolean, traceId?: string) => void;
}

interface ServiceTracesState {
  url: string;
  width: number;
  errorTraces: boolean;
  fixedTime: boolean;
  options: JaegerSearchOptions;
  traceIntervalDuration: { [key: string]: string };
  selectedTraceIntervalDuration: string;
  selectedStatusCode: string;
  selectedLimitSpans: string;
  traces: JaegerTrace[];
}

const traceDurationUnits: { [key: string]: string } = {
  us: 'us',
  ms: 'ms',
  s: 's'
};

class ServiceTracesC extends React.Component<ServiceTracesProps, ServiceTracesState> {
  constructor(props: ServiceTracesProps) {
    super(props);
    let limit =
      HistoryManager.getParam(URLParam.JAEGER_LIMIT_TRACES) ||
      sessionStorage.getItem(URLParam.JAEGER_LIMIT_TRACES) ||
      '20';
    this.saveValue('JAEGER_LIMIT_TRACES', limit);
    let tags = '';
    const statusCode =
      HistoryManager.getParam(URLParam.JAEGER_STATUS_CODE) ||
      sessionStorage.getItem(URLParam.JAEGER_STATUS_CODE) ||
      'none';
    if (this.props.errorTags) {
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
    const traceID = HistoryManager.getParam(URLParam.JAEGER_TRACE_ID) || undefined;
    if (traceID) {
      this.props.onRefresh(true, traceID);
    }
    this.state = {
      url: '',
      width: 0,
      fixedTime: true,
      errorTraces: this.props.errorTags || false,
      options: {
        limit: limit,
        tags: tags
      },
      traceIntervalDuration: { none: 'none' },
      selectedTraceIntervalDuration: interval,
      selectedStatusCode: statusCode,
      selectedLimitSpans: limit,
      traces: this.filterTraces(interval)
    };
    this.props.onRefresh();
  }

  componentDidUpdate(prevProps: ServiceTracesProps) {
    if (
      this.props.traces.length !== prevProps.traces.length ||
      (prevProps.traces.length > 0 &&
        this.props.traces.length > 0 &&
        prevProps.traces[0].startTime !== this.props.traces[0].startTime)
    ) {
      this.getIntervalTraceDurations();
      const interval =
        HistoryManager.getParam(URLParam.JAEGER_TRACE_INTERVAL_SELECTED) ||
        sessionStorage.getItem(URLParam.JAEGER_TRACE_INTERVAL_SELECTED) ||
        'none';
      this.setState({ traces: this.filterTraces(interval) });
    }
  }

  filterTraces = (interval: string): JaegerTrace[] => {
    if (interval === 'none') {
      return this.props.traces;
    }
    const duration = interval.split('-');
    const index = Object.keys(traceDurationUnits).findIndex(el => el === duration[2]);
    let min = Number(duration[0]) * Math.pow(1000, index);
    let max = Number(duration[1]) * Math.pow(1000, index);
    this.props.traces.filter(trace => trace.duration >= min && trace.duration <= max);
    return this.props.traces.filter(trace => trace.duration >= min && trace.duration <= max);
  };

  setErrorTraces = () => {
    const errorTraces = !this.state.errorTraces;
    this.setState({ errorTraces: !this.state.errorTraces });
    let tags = this.state.options.tags || '';
    if (errorTraces) {
      tags === '' ? (tags = 'error=true') : (tags += ' error=true');
    } else {
      tags = tags.replace(/ ?error=true/, '');
    }
    this.onOptionsChange('JAEGER_TAGS', tags);
    this.props.onRefresh();
  };

  saveValue = (key: string, value: string) => {
    sessionStorage.setItem(URLParam[key], value);
    HistoryManager.setParam(URLParam[key], value);
  };

  removeValue = (key: string) => {
    sessionStorage.removeItem(URLParam[key]);
    HistoryManager.deleteParam(URLParam[key]);
  };

  onOptionsChange = (key: string, value: string) => {
    let options = this.state.options;
    options[URLParam[key]] = value;
    value !== ''
      ? key !== 'JAEGER_TAGS'
        ? this.saveValue(key, value)
        : this.saveValue(key, convTagsLogfmt(value))
      : this.removeValue(key);
    this.setState({ options: options });
  };

  getJaegerUrl = () => {
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

  handleStatusCode = (key: string) => {
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
    this.props.onRefresh();
  };

  handleIntervalDuration = (key: string) => {
    if (key === 'none') {
      this.removeValue('JAEGER_TRACE_INTERVAL_SELECTED');
      this.setState({ selectedTraceIntervalDuration: key, traces: this.props.traces });
    } else {
      this.saveValue('JAEGER_TRACE_INTERVAL_SELECTED', key);
      this.setState({ selectedTraceIntervalDuration: key, traces: this.filterTraces(key) });
    }
  };

  handleLimitDuration = (key: string) => {
    this.setState({ selectedLimitSpans: key });
    this.onOptionsChange('JAEGER_LIMIT_TRACES', key);
    this.props.onRefresh();
  };

  getIntervalTraceDurations = () => {
    let maxDuration = Math.max.apply(Math, this.props.traces.map(trace => trace.duration));
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
    this.setState({ traceIntervalDuration: intervals });
  };

  onClickScatter = (traceId: string) => {
    HistoryManager.setParam(URLParam.JAEGER_TRACE_ID, traceId);
    this.props.onRefresh(true, traceId);
  };

  render() {
    return (
      <RenderComponentScroll>
        <Grid style={{ padding: '20px' }}>
          <GridItem span={12}>
            <Card>
              <CardBody>
                <RenderHeader>
                  <Grid>
                    <GridItem span={2}>
                      <Text component={TextVariants.h5} style={{ display: '-webkit-inline-box', marginRight: '10px' }}>
                        Interval Trace
                      </Text>
                      <ToolbarDropdown
                        options={this.state.traceIntervalDuration}
                        value={this.state.traceIntervalDuration[this.state.selectedTraceIntervalDuration]}
                        handleSelect={key => this.handleIntervalDuration(key)}
                      />
                    </GridItem>
                    <GridItem span={2}>
                      <Text component={TextVariants.h5} style={{ display: '-webkit-inline-box', marginRight: '10px' }}>
                        Limit Results
                      </Text>
                      <ToolbarDropdown
                        options={config.tracing.configuration.limitResults}
                        value={config.tracing.configuration.limitResults[this.state.selectedLimitSpans]}
                        handleSelect={key => this.handleLimitDuration(key)}
                      />
                    </GridItem>
                    <GridItem span={2}>
                      <Text
                        component={TextVariants.h5}
                        style={{ display: '-webkit-inline-box', marginLeft: '-40px', marginRight: '10px' }}
                      >
                        Status Code
                      </Text>
                      <ToolbarDropdown
                        options={config.tracing.configuration.statusCode}
                        value={config.tracing.configuration.statusCode[this.state.selectedStatusCode]}
                        handleSelect={key => this.handleStatusCode(key)}
                      />
                    </GridItem>
                    <GridItem span={2}>
                      <div style={{ marginTop: '10px' }}>
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
                      </div>
                    </GridItem>
                    <GridItem span={2} />
                    <GridItem span={2}>
                      <Tooltip content={<>{!this.state.errorTraces ? 'Show Error Traces' : 'Show All Traces'}</>}>
                        <Button
                          variant="tertiary"
                          onClick={() => this.setErrorTraces()}
                          style={this.state.errorTraces ? { backgroundColor: PfColors.Blue100 } : {}}
                        >
                          {!this.state.errorTraces ? 'Errors' : 'All'}
                        </Button>
                      </Tooltip>
                      {this.props.urlJaeger !== '' && (
                        <Tooltip content={<>Open Chart in Jaeger UI</>}>
                          <Button
                            variant="link"
                            onClick={() => window.open(this.getJaegerUrl(), '_blank')}
                            style={{ marginLeft: '10px' }}
                          >
                            View in Tracing <ExternalLinkAltIcon />
                          </Button>
                        </Tooltip>
                      )}
                    </GridItem>
                  </Grid>
                </RenderHeader>
                <Grid style={{ margin: '20px' }}>
                  <GridItem span={12}>
                    <JaegerScatter
                      fixedTime={this.state.fixedTime}
                      traces={this.state.traces}
                      errorFetchTraces={this.props.errorTraces}
                      onClick={traceId => this.onClickScatter(traceId)}
                      errorTraces={true}
                    />
                  </GridItem>
                  <GridItem span={12}>
                    {this.props.selectedTrace && (
                      <JaegerItem
                        trace={this.props.selectedTrace}
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
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    urlJaeger: state.jaegerState ? state.jaegerState.jaegerURL : '',
    namespaceSelector: state.jaegerState ? state.jaegerState.namespaceSelector : true
  };
};

export const ServiceTraces = connect(mapStateToProps)(ServiceTracesC);

export default ServiceTraces;
