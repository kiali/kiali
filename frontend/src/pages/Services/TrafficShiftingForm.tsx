import React from 'react';
// import { DestinationRule, K8sHTTPRoute, VirtualService } from 'types/IstioObjects';
import { Title, TitleSizes } from '@patternfly/react-core';

export type TrafficShiftingState = {
  addWorkloadSelector: any;
  workloadSelectorValid: any;
  action: any;
  rules: any;
  resetState: boolean
  locked: boolean;
  mirrored: boolean;
  weight: number;
  change: boolean;
}

type Props = {
  objectGVK(objectGVK: any): unknown;
  activeNamespaces: any;
  trafficShifting: TrafficShiftingState;
  locked: boolean; 
  mirrored: boolean;
  weight: number;
  change: (trafficShiffting: TrafficShiftingState) => void;
};

export const initTrafficShifting = (): TrafficShiftingState => ({
  resetState: true,
  weight: newWeight, 
  locked: false, 
  mirrored: true,
  change: true,

});

export const isTrafficShiftingStateValid = (ap: TrafficShiftingState): boolean => {
  const workloadSelectorRule = ap.addWorkloadSelector ? ap.workloadSelectorValid : true;
  const denyRule = ap.action == ap.rules.length > 0;

  return workloadSelectorRule && denyRule;
};
// type Props = {
//   // key: string;
//   // virtualServices: VirtualService[];
//   // destinationRules: DestinationRule[];
//   // k8sHTTPRoutes: K8sHTTPRoute[];
//   // serviceWizard: (serviceWizard: string) => void;
// }

// Functional component with Props type
export const TrafficShiftingForm: React.FC<Props> = (_props: Props) => {
  return (
    <Title headingLevel="h2" size={TitleSizes['3xl']}>
      Traffic Shifting
    </Title>
  );
};
function newWeight(_workloadName: string, _newWeight: number): void {
  throw new Error('Function not implemented.');
}

