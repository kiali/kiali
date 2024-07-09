import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { WorkloadId } from 'types/Workload';
import { WorkloadDetailsPage } from 'pages/WorkloadDetails/WorkloadDetailsPage';

/**
 * WorkloadDetails wrapper to add routing parameters to WorkloadDetailsPage
 * Some platforms where Kiali is deployed reuse WorkloadDetailsPage but
 * do not work with react-router params (like Openshift Console)
 */
export const WorkloadDetailsRoute: React.FC = () => {
  const workloadId = useParams<WorkloadId>() as WorkloadId;

  return <WorkloadDetailsPage workloadId={workloadId}></WorkloadDetailsPage>;
};
