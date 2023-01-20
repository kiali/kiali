import * as React from 'react';
import { DirectionType } from './OverviewToolbar';
import { serverConfig } from '../../config';
import { ControlPlaneMetricsMap, Metric } from '../../types/Metrics';
import { DurationInSeconds } from '../../types/Common';
import OverviewCardDataPlaneNamespace from './OverviewCardDataPlaneNamespace';
import OverviewCardControlPlaneNamespace from './OverviewCardControlPlaneNamespace';
import { IstiodResourceThresholds } from 'types/IstioStatus';

type Props = {
  name: string;
  duration: DurationInSeconds;
  direction: DirectionType
  metrics?: Metric[];
  errorMetrics?: Metric[];
  controlPlaneMetrics?: ControlPlaneMetricsMap;
  istiodResourceThresholds?: IstiodResourceThresholds;
  istioAPIEnabled?: boolean;
};

class OverviewCardSparklineCharts extends React.Component<Props> {
  render() {
    return (
      <>
        {(this.props.name !== serverConfig.istioNamespace || !this.props.istioAPIEnabled) &&
          <OverviewCardDataPlaneNamespace
            metrics={this.props.metrics}
            errorMetrics={this.props.errorMetrics}
            duration={this.props.duration}
            direction={this.props.direction}
          />
        }
        {(this.props.name === serverConfig.istioNamespace && this.props.istioAPIEnabled) &&
          <OverviewCardControlPlaneNamespace
            pilotLatency={this.props.controlPlaneMetrics?.istiod_proxy_time}
            istiodMemory={this.props.controlPlaneMetrics?.istiod_mem}
            istiodCpu={this.props.controlPlaneMetrics?.istiod_cpu}
            duration={this.props.duration}
            istiodResourceThresholds={this.props.istiodResourceThresholds}
          />
        }
      </>
    );
  }
}

export default OverviewCardSparklineCharts;
