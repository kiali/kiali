import * as React from 'react';
import { useParams } from 'react-router';
import { WorkloadId } from 'types/Workload';
import WorkloadDetailsPage from 'pages/WorkloadDetails/WorkloadDetailsPage';

const WorkloadDetailsRoute = () => {
  const workloadId = useParams<WorkloadId>();

  return <WorkloadDetailsPage workloadId={workloadId}></WorkloadDetailsPage>;
};

export default WorkloadDetailsRoute;
