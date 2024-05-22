// Node Shapes
import dataPlaneImage from '../../assets/img/mesh/node-dataplane.svg';
import infraNodeImage from '../../assets/img/mesh/node-infra.svg';

// Node Colors
import nodeColorHealthyImage from '../../assets/img/legend-pf/node-color-healthy.svg';
import nodeColorDangerImage from '../../assets/img/legend-pf/node-color-danger.svg';

// Edges
import edgeSuccessImage from '../../assets/img/mesh/edge-healthy.svg';
import edgeDangerImage from '../../assets/img/mesh/edge-unhealthy.svg';

// Node Background
import dataplane from '../../assets/img/mesh/dataplane.svg';
import jaegerLogo from '../../assets/img/mesh/jaeger.svg';
import prometheusLogo from '../../assets/img/mesh/prometheus.svg';
import grafanaLogo from '../../assets/img/mesh/grafana.svg';
import istioLogo from '../../assets/img/mesh/istio.svg';
import kialiLogo from '../../assets/img/mesh/kiali.svg';
import tempoLogo from '../../assets/img/mesh/tempo.svg';

import { t } from 'utils/I18nUtils';

export interface MeshLegendItem {
  data: MeshLegendItemRow[];
  title: string;
}

export interface MeshLegendItemRow {
  icon: string;
  label: string;
  logo: boolean;
}

export const legendData: MeshLegendItem[] = [
  {
    title: t('Node Shapes'),
    data: [
      { label: t('Infra node'), icon: infraNodeImage, logo: false },
      { label: t('Data Plane'), icon: dataPlaneImage, logo: false }
    ]
  },
  {
    title: t('Node Colors'),
    data: [
      { label: t('Healthy'), icon: nodeColorHealthyImage, logo: false },
      { label: t('Unhealthy'), icon: nodeColorDangerImage, logo: false }
    ]
  },
  {
    title: t('Edges'),
    data: [
      { label: t('Failure'), icon: edgeDangerImage, logo: false },
      { label: t('Healthy'), icon: edgeSuccessImage, logo: false }
    ]
  },
  {
    title: t('Node Background'),
    data: [
      { label: t('Data Plane'), icon: dataplane, logo: true },
      { label: t('Grafana'), icon: grafanaLogo, logo: true },
      { label: t('Jaeger'), icon: jaegerLogo, logo: true },
      { label: t('Kiali'), icon: kialiLogo, logo: true },
      { label: t('Istio'), icon: istioLogo, logo: true },
      { label: t('Prometheus'), icon: prometheusLogo, logo: true },
      { label: t('Tempo'), icon: tempoLogo, logo: true }
    ]
  }
];
