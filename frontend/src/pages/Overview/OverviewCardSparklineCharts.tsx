import * as React from 'react';
import { DirectionType } from './OverviewToolbar';
import { serverConfig } from '../../config';
import { ControlPlaneMetricsMap, Metric } from '../../types/Metrics';
import { DurationInSeconds } from '../../types/Common';
import { OverviewCardDataPlaneNamespace } from './OverviewCardDataPlaneNamespace';
import { isRemoteCluster, OverviewCardControlPlaneNamespace } from './OverviewCardControlPlaneNamespace';
import { IstiodResourceThresholds } from 'types/IstioStatus';
import { connect } from 'react-redux';
import { KialiAppState } from 'store/Store';

type ReduxProps = {
  istioAPIEnabled: boolean;
};

type Props = ReduxProps & {
  annotations?: { [key: string]: string };
  controlPlaneMetrics?: ControlPlaneMetricsMap;
  direction: DirectionType;
  duration: DurationInSeconds;
  errorMetrics?: Metric[];
  istiodResourceThresholds?: IstiodResourceThresholds;
  metrics?: Metric[];
  name: string;
};

const OverviewCardSparklineChartsComponent: React.FC<Props> = (props: Props) => {
  return (
    <>
      {props.name !== serverConfig.istioNamespace && (
        <OverviewCardDataPlaneNamespace
          metrics={props.metrics}
          errorMetrics={props.errorMetrics}
          duration={props.duration}
          direction={props.direction}
        />
      )}

      {props.name === serverConfig.istioNamespace && props.istioAPIEnabled && !isRemoteCluster(props.annotations) && (
        <OverviewCardControlPlaneNamespace
          pilotLatency={props.controlPlaneMetrics?.istiod_proxy_time}
          istiodContainerMemory={props.controlPlaneMetrics?.istiod_container_mem}
          istiodContainerCpu={props.controlPlaneMetrics?.istiod_container_cpu}
          istiodProcessMemory={props.controlPlaneMetrics?.istiod_process_mem}
          istiodProcessCpu={props.controlPlaneMetrics?.istiod_process_cpu}
          istiodResourceThresholds={props.istiodResourceThresholds}
        />
      )}
    </>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  istioAPIEnabled: state.statusState.istioEnvironment.istioAPIEnabled
});

export const OverviewCardSparklineCharts = connect(mapStateToProps)(OverviewCardSparklineChartsComponent);
