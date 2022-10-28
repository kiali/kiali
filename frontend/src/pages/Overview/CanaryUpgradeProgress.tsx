import { ChartDonutUtilization, ChartThemeColor } from '@patternfly/react-charts';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { CanaryUpgradeStatus } from 'types/IstioObjects';
import { style } from 'typestyle';

type Props = {
    canaryUpgradeStatus: CanaryUpgradeStatus;
};

export const infoStyle = style({
    margin: '0px 0px -1px 4px'
});


class CanaryUpgradeProgress extends React.Component<Props> {
    render() {
        const total = this.props.canaryUpgradeStatus.migratedNamespaces.length + this.props.canaryUpgradeStatus.pendingNamespaces.length;
        const migrated = (total > 0) ? this.props.canaryUpgradeStatus.migratedNamespaces.length * 100 / total : 0;

        return (
            <div style={{ textAlign: 'center' }} data-test="canary-upgrade">
                <div>
                    <div>
                        Canary upgrade status
                        <Tooltip
                            position={TooltipPosition.right}
                            content={`There is an in progress canary upgrade from version "${this.props.canaryUpgradeStatus.currentVersion}" to version "${this.props.canaryUpgradeStatus.upgradeVersion}"`}
                        >
                            <KialiIcon.Info className={infoStyle} />
                        </Tooltip>
                    </div>
                    <div style={{ height: 180 }}>
                        <ChartDonutUtilization
                            ariaDesc="Canary upgrade status"
                            ariaTitle="Canary upgrade status"
                            constrainToVisibleArea
                            data={{ x: 'Migrated namespaces', y: migrated }}
                            labels={({ datum }) => datum.x ? `${datum.x}: ${datum.y.toFixed(2)}%` : null}
                            invert
                            title={`${migrated.toFixed(2)}%`}
                            height={170}
                            themeColor={ChartThemeColor.green}
                        />
                    </div>
                    <div><p>{`${this.props.canaryUpgradeStatus.migratedNamespaces.length} of ${total} namespaces migrated`}</p></div>
                </div>
            </div>
        );
    }
}

export default CanaryUpgradeProgress;
