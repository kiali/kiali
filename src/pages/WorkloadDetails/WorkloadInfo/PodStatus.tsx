import React from 'react';
import { ObjectCheck, ValidationTypes } from '../../../types/IstioObjects';
import { DEGRADED, HEALTHY, isProxyStatusSynced, mergeStatus, ProxyStatus, Status } from '../../../types/Health';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { createIcon } from '../../../components/Health/Helper';
import ProxyStatusList from './ProxyStatusList';
import { highestSeverity, validationToHealth } from '../../../types/ServiceInfo';
import ValidationStack from '../../../components/Validations/ValidationStack';
import './PodStatus.css';

type Props = {
  checks?: ObjectCheck[];
  status?: ProxyStatus;
};

class PodStatus extends React.Component<Props> {
  proxyStatusSeverity = (): Status => {
    return this.props.status && !isProxyStatusSynced(this.props.status) ? DEGRADED : HEALTHY;
  };

  severityIcon = () => {
    const proxyStatusSeverity: Status = this.proxyStatusSeverity();
    const validationSeverity: Status = validationToHealth(highestSeverity(this.props.checks || []));
    return mergeStatus(proxyStatusSeverity, validationSeverity);
  };

  showTooltip = (): boolean => {
    const proxyStatusSeverity: Status = this.proxyStatusSeverity();
    const validationSeverity: ValidationTypes = highestSeverity(this.props.checks || []);
    return proxyStatusSeverity.name !== HEALTHY.name || validationSeverity !== ValidationTypes.Correct;
  };

  content = () => {
    return (
      <div className="pod-status-tooltip">
        <ProxyStatusList status={this.props.status} />
        <ValidationStack checks={this.props.checks} />
      </div>
    );
  };

  render() {
    if (this.showTooltip()) {
      return (
        <Tooltip aria-label={'Pod Status'} position={TooltipPosition.auto} enableFlip={true} content={this.content()}>
          <span>{createIcon(this.severityIcon(), 'sm')}</span>
        </Tooltip>
      );
    } else {
      return createIcon(HEALTHY, 'sm');
    }
  }
}
export default PodStatus;
