import * as React from 'react';
import { useParams } from 'react-router';
import { IstioConfigId } from 'types/IstioConfigDetails';
import { IstioConfigDetailsPage } from 'pages/IstioConfigDetails/IstioConfigDetailsPage';

/**
 * IstioConfigDetails wrapper to add routing parameters to IstioConfigDetailsPage
 * Some platforms where Kiali is deployed reuse IstioConfigDetailsPage but
 * do not work with react-router params (like Openshift Console)
 */
export const IstioConfigDetailsRoute = () => {
  const istioConfigId = useParams<IstioConfigId>();

  return <IstioConfigDetailsPage istioConfigId={istioConfigId}></IstioConfigDetailsPage>;
};
