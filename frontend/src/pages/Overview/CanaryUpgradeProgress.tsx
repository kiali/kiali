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

export const CanaryUpgradeProgress: React.FC<Props> = (props: Props) => {
  const total =
    props.canaryUpgradeStatus.migratedNamespaces.length + props.canaryUpgradeStatus.pendingNamespaces.length;

  const migrated = total > 0 ? (props.canaryUpgradeStatus.migratedNamespaces.length * 100) / total : 0;

  return (
    <div style={{ textAlign: 'center' }} data-test="canary-upgrade">
      <span>Canary upgrade status</span>

      <Tooltip
        position={TooltipPosition.right}
        content={`There is an in progress canary upgrade from version "${props.canaryUpgradeStatus.currentVersion}" to version "${props.canaryUpgradeStatus.upgradeVersion}"`}
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

      <p>{`${props.canaryUpgradeStatus.migratedNamespaces.length} of ${total} namespaces migrated`}</p>
    </div>
  );
};
