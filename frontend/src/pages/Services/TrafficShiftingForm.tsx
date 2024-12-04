import React from 'react';
// import { DestinationRule, K8sHTTPRoute, VirtualService } from 'types/IstioObjects';
import { Title, TitleSizes } from '@patternfly/react-core';
import { WorkloadWeight } from 'components/IstioWizards/TrafficShifting';

export type TrafficShiftingHead = {
  key: string;
  showValid: boolean;
  workloads: WorkloadWeight[];

  
}

type Props = {
  // key: string;
  // virtualServices: VirtualService[];
  // destinationRules: DestinationRule[];
  // k8sHTTPRoutes: K8sHTTPRoute[];
  // serviceWizard: (serviceWizard: string) => void;
}

// Functional component with Props type
export const TrafficShiftingForm: React.FC<Props> = (_props: Props) => {
  return (
    <Title headingLevel="h2" size={TitleSizes['3xl']}>
      Traffic Shifting
    </Title>
  );
};
