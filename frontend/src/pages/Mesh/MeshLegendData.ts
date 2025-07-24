// Node Shapes
import dataPlaneImage from '../../assets/img/mesh/node-dataplane.svg';
import gatewayImage from '../../assets/img/mesh/node-gateway.svg';
import infraNodeImage from '../../assets/img/mesh/node-infra.svg';

// Node Colors
import nodeColorHealthyImage from '../../assets/img/mesh/node-color-healthy.svg';
import nodeColorDangerImage from '../../assets/img/mesh/node-color-danger.svg';

// Edges
import edgeSuccessImage from '../../assets/img/mesh/edge-healthy.svg';
import edgeDangerImage from '../../assets/img/mesh/edge-unhealthy.svg';

// Node Background
import dataplane from '../../assets/img/mesh/dataplane.svg';
import gateway from '../../assets/img/mesh/gateway.svg';
import jaegerLogo from '../../assets/img/mesh/jaeger.svg';
import prometheusLogo from '../../assets/img/mesh/prometheus.svg';
import grafanaLogo from '../../assets/img/mesh/grafana.svg';
import istioLogo from '../../assets/img/mesh/istio.svg';
import kialiLogo from '../../assets/img/mesh/kiali.svg';
import persesLogo from '../../assets/img/mesh/perses.svg';
import tempoLogo from '../../assets/img/mesh/tempo.svg';
import waypoint from '../../assets/img/mesh/waypoint.svg';

import { t } from 'utils/I18nUtils';

export interface MeshLegendItem {
  data: MeshLegendItemRow[];
  isLogo?: boolean;
  title: string;
}

export interface MeshLegendItemRow {
  icon: string;
  label: string;
}

export const legendData: MeshLegendItem[] = [
  {
    title: t('Node Shapes'),
    data: [
      { label: t('Infra node'), icon: infraNodeImage },
      { label: t('Data Plane'), icon: dataPlaneImage },
      { label: t('Gateway/Waypoint'), icon: gatewayImage }
    ]
  },
  {
    title: t('Node Colors'),
    data: [
      { label: t('Healthy'), icon: nodeColorHealthyImage },
      { label: t('Unhealthy'), icon: nodeColorDangerImage }
    ]
  },
  {
    title: t('Edges'),
    data: [
      { label: t('Failure'), icon: edgeDangerImage },
      { label: t('Healthy'), icon: edgeSuccessImage }
    ]
  },
  {
    title: t('Node Background'),
    isLogo: true,
    data: [
      { label: t('Data Plane'), icon: dataplane },
      { label: t('Gateway'), icon: gateway },
      { label: 'Grafana', icon: grafanaLogo },
      { label: 'Jaeger', icon: jaegerLogo },
      { label: 'Kiali', icon: kialiLogo },
      { label: 'Istio', icon: istioLogo },
      { label: 'Perses', icon: persesLogo },
      { label: 'Prometheus', icon: prometheusLogo },
      { label: 'Tempo', icon: tempoLogo },
      { label: t('Waypoint'), icon: waypoint }
    ]
  }
];
