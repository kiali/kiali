import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { AppId } from 'types/App';
import { AppDetailsPage } from 'pages/AppDetails/AppDetailsPage';

/**
 * AppDetails wrapper to add routing parameters to AppDetailsPage
 * Some platforms where Kiali is deployed reuse AppDetailsPage but
 * do not work with react-router params (like Openshift Console)
 */
export const AppDetailsRoute: React.FC = () => {
  const appId = useParams<AppId>() as AppId;

  return <AppDetailsPage appId={appId}></AppDetailsPage>;
};
