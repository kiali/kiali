import * as React from 'react';
import { useParams } from 'react-router';
import { AppId } from 'types/App';
import AppDetailsPage from 'pages/AppDetails/AppDetailsPage';

/**
 * AppDetails wrapper to add routing parameters to AppDetailsPage
 * since some platforms does not work with react-router params (like Openshift Console)
 */
const AppDetailsRoute = () => {
  const appId = useParams<AppId>();

  return <AppDetailsPage appId={appId}></AppDetailsPage>;
};

export default AppDetailsRoute;
