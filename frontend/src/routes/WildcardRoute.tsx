import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom-v5-compat';

import * as AlertUtils from '../utils/AlertUtils';

export const WildcardRoute = (): JSX.Element => {
  const [searchParams] = useSearchParams();
  const openshiftError = searchParams.get('openshift_error');

  if (openshiftError) {
    AlertUtils.addError(
      'Openshift authentication to remote cluster failed',
      undefined,
      undefined,
      undefined,
      openshiftError
    );
  }

  return <Navigate to="/overview" replace />;
};
