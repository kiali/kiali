import * as React from 'react';
import { useParams } from 'react-router';
import { WorkloadId } from 'types/Workload';
import WorkloadDetailsPage from 'pages/WorkloadDetails/WorkloadDetailsPage';

/**
 * WorkloadDetails wrapper to add routing parameters to WorkloadDetailsPage
 * Some platforms where Kiali is deployed reuse WorkloadDetailsPage but
 * do not work with react-router params (like Openshift Console)
 */
const WorkloadDetailsRoute = () => {
  const workloadId = useParams<WorkloadId>();

  return <WorkloadDetailsPage workloadId={workloadId}></WorkloadDetailsPage>;
};

export default WorkloadDetailsRoute;
