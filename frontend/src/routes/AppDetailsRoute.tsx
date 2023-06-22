import * as React from 'react';
import { useParams } from 'react-router';
import { AppId } from 'types/App';
import AppDetailsPage from 'pages/AppDetails/AppDetailsPage';

const AppDetailsRoute = () => {
  const appId = useParams<AppId>();

  return <AppDetailsPage appId={appId}></AppDetailsPage>;
};

export default AppDetailsRoute;
