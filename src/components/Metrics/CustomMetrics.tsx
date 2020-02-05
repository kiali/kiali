import * as React from 'react';
import { connect } from 'react-redux';
import { RouteComponentProps, withRouter } from 'react-router';
import { Toolbar, ToolbarGroup, ToolbarItem } from '@patternfly/react-core';
import { Dashboard, DashboardModel, DashboardQuery, Aggregator, ExternalLink, Overlay } from '@kiali/k-charted-pf4';
import { style } from 'typestyle';

import { serverConfig } from '../../config/ServerConfig';
import history from '../../app/History';
import RefreshContainer from '../../components/Refresh/Refresh';
import * as API from '../../services/Api';
import { KialiAppState } from '../../store/Store';
import { TimeRange, evalTimeRange } from '../../types/Common';
import * as AlertUtils from '../../utils/AlertUtils';
import { RenderComponentScroll } from '../../components/Nav/Page';
import * as MetricsHelper from './Helper';
import { MetricsSettings, LabelsSettings } from '../MetricsOptions/MetricsSettings';
import { MetricsSettingsDropdown } from '../MetricsOptions/MetricsSettingsDropdown';
import MetricsRawAggregation from '../MetricsOptions/MetricsRawAggregation';
import { GrafanaLinks } from './GrafanaLinks';
import { MetricsObjectTypes } from 'types/Metrics';
import { SpanOverlay } from './SpanOverlay';
import TimeRangeComponent from 'components/Time/TimeRangeComponent';
import { retrieveTimeRange } from 'components/Time/TimeRangeHelper';

type MetricsState = {
  dashboard?: DashboardModel;
  labelsSettings: LabelsSettings;
  grafanaLinks: ExternalLink[];
  spanOverlay?: Overlay;
};

type CustomMetricsProps = RouteComponentProps<{}> & {
  namespace: string;
  app: string;
  version?: string;
  template: string;
};

type Props = CustomMetricsProps & {
  // Redux props
  jaegerIntegration: boolean;
};

const displayFlex = style({
  display: 'flex'
});

export class CustomMetrics extends React.Component<Props, MetricsState> {
  options: DashboardQuery;
  timeRange: TimeRange;
  spanOverlay: SpanOverlay;

  constructor(props: Props) {
    super(props);

    const settings = MetricsHelper.retrieveMetricsSettings();
    this.timeRange = retrieveTimeRange() || MetricsHelper.defaultMetricsDuration;
    this.options = this.initOptions(settings);
    // Initialize active filters from URL
    this.state = { labelsSettings: settings.labelsSettings, grafanaLinks: [] };
    this.spanOverlay = new SpanOverlay(changed => this.setState({ spanOverlay: changed }));
  }

  initOptions(settings: MetricsSettings): DashboardQuery {
    const filters = `${serverConfig.istioLabels.appLabelName}:${this.props.app}`;
    const options: DashboardQuery = this.props.version
      ? {
          labelsFilters: `${filters},${serverConfig.istioLabels.versionLabelName}:${this.props.version}`
        }
      : {
          labelsFilters: filters,
          additionalLabels: 'version:Version'
        };
    MetricsHelper.settingsToOptions(settings, options);
    return options;
  }

  componentDidMount() {
    this.refresh();
  }

  refresh = () => {
    this.fetchMetrics();
    if (this.props.jaegerIntegration) {
      this.spanOverlay.fetch(
        this.props.namespace,
        this.props.app,
        this.options.duration || MetricsHelper.defaultMetricsDuration
      );
    }
  };

  fetchMetrics = () => {
    // Time range needs to be reevaluated everytime fetching
    MetricsHelper.timeRangeToOptions(this.timeRange, this.options);
    API.getCustomDashboard(this.props.namespace, this.props.template, this.options)
      .then(response => {
        const labelsSettings = MetricsHelper.extractLabelsSettings(response.data, this.state.labelsSettings);
        this.setState({
          dashboard: response.data,
          labelsSettings: labelsSettings,
          grafanaLinks: response.data.externalLinks
        });
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch custom dashboard.', error);
      });
  };

  onMetricsSettingsChanged = (settings: MetricsSettings) => {
    MetricsHelper.settingsToOptions(settings, this.options);
    this.fetchMetrics();
  };

  onLabelsFiltersChanged = (labelsFilters: LabelsSettings) => {
    this.setState({ labelsSettings: labelsFilters });
  };

  onTimeFrameChanged = (range: TimeRange) => {
    this.timeRange = range;
    this.spanOverlay.resetLastFetchTime();
    this.refresh();
  };

  onRawAggregationChanged = (aggregator: Aggregator) => {
    this.options.rawDataAggregator = aggregator;
    this.fetchMetrics();
  };

  render() {
    if (!this.state.dashboard) {
      return this.renderOptionsBar();
    }

    const urlParams = new URLSearchParams(history.location.search);
    const expandedChart = urlParams.get('expand') || undefined;

    return (
      <RenderComponentScroll>
        {this.renderOptionsBar()}
        <Dashboard
          dashboard={this.state.dashboard}
          labelValues={MetricsHelper.convertAsPromLabels(this.state.labelsSettings)}
          expandedChart={expandedChart}
          expandHandler={this.expandHandler}
          overlay={this.state.spanOverlay}
          timeWindow={evalTimeRange(retrieveTimeRange() || MetricsHelper.defaultMetricsDuration)}
        />
      </RenderComponentScroll>
    );
  }

  renderOptionsBar() {
    const hasHistograms =
      this.state.dashboard !== undefined &&
      this.state.dashboard.charts.some(chart => {
        if (chart.histogram) {
          return Object.keys(chart.histogram).length > 0;
        }
        return false;
      });
    return (
      <Toolbar style={{ padding: 10 }}>
        <ToolbarGroup>
          <ToolbarItem>
            <MetricsSettingsDropdown
              onChanged={this.onMetricsSettingsChanged}
              onLabelsFiltersChanged={this.onLabelsFiltersChanged}
              labelsSettings={this.state.labelsSettings}
              hasHistograms={hasHistograms}
            />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup>
          <ToolbarItem className={displayFlex}>
            <MetricsRawAggregation onChanged={this.onRawAggregationChanged} />
          </ToolbarItem>
        </ToolbarGroup>
        <ToolbarGroup>
          <GrafanaLinks
            links={this.state.grafanaLinks}
            namespace={this.props.namespace}
            object={this.props.app}
            objectType={MetricsObjectTypes.APP}
            version={this.props.version}
          />
        </ToolbarGroup>
        <ToolbarGroup style={{ marginLeft: 'auto', marginRight: 0 }}>
          <ToolbarItem>
            <TimeRangeComponent
              onChanged={this.onTimeFrameChanged}
              tooltip={'Time range for metrics'}
              allowCustom={true}
            />
          </ToolbarItem>
          <ToolbarItem>
            <RefreshContainer id="metrics-refresh" handleRefresh={this.refresh} hideLabel={true} />
          </ToolbarItem>
        </ToolbarGroup>
      </Toolbar>
    );
  }

  private expandHandler = (expandedChart?: string) => {
    const urlParams = new URLSearchParams(history.location.search);
    urlParams.delete('expand');
    if (expandedChart) {
      urlParams.set('expand', expandedChart);
    }
    history.push(history.location.pathname + '?' + urlParams.toString());
  };
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    jaegerIntegration: state.jaegerState ? state.jaegerState.integration : false
  };
};

const CustomMetricsContainer = withRouter<RouteComponentProps<{}> & CustomMetricsProps, any>(
  connect(mapStateToProps)(CustomMetrics)
);

export default CustomMetricsContainer;
