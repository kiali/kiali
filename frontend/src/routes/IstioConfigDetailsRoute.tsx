import * as React from 'react';
import { useParams } from 'react-router';
import { IstioConfigId } from 'types/IstioConfigDetails';
import IstioConfigDetailsPage from 'pages/IstioConfigDetails/IstioConfigDetailsPage';

const IstioConfigDetailsRoute = () => {
  const istioConfigId = useParams<IstioConfigId>();

  return <IstioConfigDetailsPage istioConfigId={istioConfigId}></IstioConfigDetailsPage>;
};

export default IstioConfigDetailsRoute;
