import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom-v5-compat';

import * as AlertUtils from '../utils/AlertUtils';

const OVERVIEW_ROUTE = '/overview';

export const WildcardRoute = (): JSX.Element => {
  const [searchParams] = useSearchParams();
  const openshiftError = searchParams.get('openshift_error');
  const cluster = searchParams.get('cluster');

  if (openshiftError) {
    const clusterMessage = cluster ? `to cluster ${cluster}` : 'to cluster';
    AlertUtils.addError(
      `Openshift authentication ${clusterMessage} failed`,
      undefined,
      undefined,
      undefined,
      openshiftError
    );
  }

  return <Navigate to={OVERVIEW_ROUTE} replace />;
};
