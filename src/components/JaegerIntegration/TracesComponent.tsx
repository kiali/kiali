import * as React from 'react';
import {
  Card,
  CardBody,
  Grid,
  GridItem,
  Tab,
  Tabs,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip
} from '@patternfly/react-core';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';
import { connect } from 'react-redux';

import { RenderComponentScroll, RenderHeader } from '../Nav/Page';
import { KialiAppState } from '../../store/Store';
import { JaegerError, JaegerTrace } from '../../types/JaegerInfo';
import TraceDetails from './JaegerResults/TraceDetails';
import JaegerScatter from './JaegerScatter';
import { TracesFetcher } from './TracesFetcher';
import { SpanDetails } from './JaegerResults/SpanDetails';
import { isEqualTimeRange, TargetKind, TimeInMilliseconds, TimeRange } from 'types/Common';
import { timeRangeSelector } from '../../store/Selectors';
import { getTimeRangeMicros } from 'utils/tracing/TracingHelper';
import { TracesDisplayOptions, QuerySettings, DisplaySettings } from './TracesDisplayOptions';

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
}

const traceDetailsTab = 0;
const spansDetailsTab = 1;

class TracesComponent extends React.Component<TracesProps, TracesState> {
  private fetcher: TracesFetcher;

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
      activeTab: traceDetailsTab
    };
    this.fetcher = new TracesFetcher(this.onTracesUpdated, errors => this.setState({ jaegerErrors: errors }));
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
    return this.state.querySettings.errorsOnly ? '{"error": "true"}' : '';
  };

  private fetchTraces = () => {
    this.fetcher.fetch(
      {
        namespace: this.props.namespace,
        target: this.props.target,
        targetKind: this.props.targetKind,
        spanLimit: this.state.querySettings.limit,
        tags: this.getTags()
      },
      this.state.traces
    );
  };

  private onTracesUpdated = (traces: JaegerTrace[], jaegerServiceName: string) => {
    const newState: Partial<TracesState> = { traces: traces };
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
    console.log(settings);
    this.fetcher.resetLastFetchTime();
    this.setState({ querySettings: settings }, this.fetchTraces);
  };

  private onDisplaySettingsChanged = (settings: DisplaySettings) => {
    console.log(settings);
    this.setState({ displaySettings: settings });
  };

  render() {
    const jaegerURL = this.getJaegerUrl();
    return (
      <>
        <RenderComponentScroll>
          <Grid gutter="md">
            <GridItem span={12}>
              <Card>
                <CardBody>
                  <RenderHeader>
                    <Toolbar>
                      <ToolbarGroup>
                        <ToolbarItem>
                          <TracesDisplayOptions
                            onDisplaySettingsChanged={this.onDisplaySettingsChanged}
                            onQuerySettingsChanged={this.onQuerySettingsChanged}
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
                    fixedTime={!this.state.displaySettings.fitToData}
                    showSpansAverage={this.state.displaySettings.showSpansAverage}
                    traces={this.state.traces}
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
                      items={this.props.selectedTrace.spans}
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
