import { Tooltip, TooltipPosition, Label } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import * as React from 'react';
import { OutboundTrafficPolicy } from 'types/IstioObjects';
import NamespaceInfo from './NamespaceInfo';
import { infoStyle } from './OverviewCardControlPlaneNamespace';

type Props = {
    namespace: NamespaceInfo
    outboundTrafficPolicy?: OutboundTrafficPolicy
};

class ControlPlaneNamespaceStatus extends React.Component<Props> {

    render() {
        let maxProxyPushTime: number | undefined = undefined;
        if (this.props.namespace.controlPlaneMetrics && this.props.namespace.controlPlaneMetrics.istiod_proxy_time) {
            maxProxyPushTime = this.props.namespace.controlPlaneMetrics?.istiod_proxy_time[0].datapoints.reduce((a, b) => a[1] < b[1] ? a : b)[1] * 1000;
        }
        let showProxyPushTime = false;
        if (maxProxyPushTime && !isNaN(maxProxyPushTime)) {
            showProxyPushTime = true;
        }

        return (
            <div style={{ textAlign: 'left' }}>
                {this.props.outboundTrafficPolicy &&
                    <div>
                        <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>Outbound policy</div>
                        <Tooltip
                            position={TooltipPosition.right}
                            content={<div style={{ textAlign: 'left' }}>This value represents the meshConfig.outboundTrafficPolicy.mode, that configures the sidecar handling of external services, that is, those services that are not defined in Istio’s internal service registry. If this option is set to ALLOW_ANY, the Istio proxy lets calls to unknown services pass through. If the option is set to REGISTRY_ONLY, then the Istio proxy blocks any host without an HTTP service or service entry defined within the mesh</div>}
                        >
                            <Label isCompact color="blue">
                                {this.props.outboundTrafficPolicy.mode}<KialiIcon.Info className={infoStyle} />
                            </Label>
                        </Tooltip>
                    </div>
                }
                {showProxyPushTime &&
                    <div>
                        <div style={{ display: 'inline-block', width: '125px', whiteSpace: 'nowrap' }}>Proxy push time</div>
                        <Tooltip
                            position={TooltipPosition.right}
                            content={<div style={{ textAlign: 'left' }}>This value represents the delay in seconds between config change and a proxy receiving all required configuration.</div>}
                        >
                            <Label isCompact color="blue">
                                {maxProxyPushTime?.toFixed(2)} ms<KialiIcon.Info className={infoStyle} />
                            </Label>

                        </Tooltip>
                    </div>
                }
            </div>
        );
    };
}

export default ControlPlaneNamespaceStatus;
