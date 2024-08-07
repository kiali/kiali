import { ChartDonutUtilization, ChartThemeColor } from '@patternfly/react-charts';
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

function countNonDefaultNamespaces(canaryUpgradeStatus: CanaryUpgradeStatus): number {
  return Object.entries(canaryUpgradeStatus.namespacesPerRevision)
    .filter(([revision]) => revision !== 'default')
    .reduce((acc, [, namespaces]) => acc + namespaces.length, 0);
}

function joinNonDefaultRevisions(canaryUpgradeStatus: CanaryUpgradeStatus): string {
  return Object.keys(canaryUpgradeStatus.namespacesPerRevision)
    .filter(revision => revision !== 'default')
    .join(', ');
}

export const CanaryUpgradeProgress: React.FC<Props> = (props: Props) => {
  const total = totalNamespaces(props.canaryUpgradeStatus);

  const migrated = total > 0 ? (countNonDefaultNamespaces(props.canaryUpgradeStatus) * 100) / total : 0;

  return (
    <div style={{ textAlign: 'center' }} data-test="canary-upgrade">
      <span>Canary upgrade status</span>

      <Tooltip
        position={TooltipPosition.right}
        content={`There is an in progress canary upgrade to revision "${joinNonDefaultRevisions(
          props.canaryUpgradeStatus
        )}"`}
      >
        <KialiIcon.Info className={infoStyle} />
      </Tooltip>

      <div style={{ height: '180px' }}>
        <ChartDonutUtilization
          ariaDesc="Canary upgrade status"
          ariaTitle="Canary upgrade status"
          constrainToVisibleArea
          data={{ x: 'Migrated namespaces', y: migrated }}
          labels={({ datum }) => (datum.x ? `${datum.x}: ${datum.y.toFixed(2)}%` : null)}
          invert
          title={`${migrated.toFixed(2)}%`}
          height={170}
          themeColor={ChartThemeColor.green}
        />
      </div>

      <p>{`${countNonDefaultNamespaces(props.canaryUpgradeStatus)} of ${total} namespaces migrated`}</p>
    </div>
  );
};
