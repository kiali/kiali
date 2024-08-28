import { ChartDonut } from '@patternfly/react-charts';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { CanaryUpgradeStatus } from 'types/IstioObjects';
import { kialiStyle } from 'styles/StyleUtils';

type Props = {
  canaryUpgradeStatus: CanaryUpgradeStatus;
};

export const infoStyle = kialiStyle({
  margin: '0 0 -0.125rem 0.25rem'
});

function totalNamespaces(canaryUpgradeStatus: CanaryUpgradeStatus): number {
  return Object.values(canaryUpgradeStatus.namespacesPerRevision).reduce(
    (acc, namespaces) => acc + namespaces.length,
    0
  );
}

function convertToChartData(canaryUpgradeStatus: CanaryUpgradeStatus): { x: string; y: number }[] {
  return Object.entries(canaryUpgradeStatus.namespacesPerRevision).map(([key, value]) => ({
    x: key,
    y: value.length
  }));
}

export const CanaryUpgradeProgress: React.FC<Props> = (props: Props) => {
  const total = totalNamespaces(props.canaryUpgradeStatus);

  return (
    <div style={{ textAlign: 'center' }} data-test="canary-upgrade">
      <span>Canary upgrade status</span>

      <Tooltip
        position={TooltipPosition.right}
        content={`There is an in progress canary upgrade of namespaces per control plane revision`}
      >
        <KialiIcon.Info className={infoStyle} />
      </Tooltip>

      <div style={{ height: '180px' }}>
        <ChartDonut
          data={convertToChartData(props.canaryUpgradeStatus)}
          labels={({ datum }) => (datum.x ? `${datum.x}: ${datum.y}, ${((datum.y * 100) / total).toFixed(2)}%` : null)}
          height={170}
        />
      </div>
    </div>
  );
};
