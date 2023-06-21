import * as React from 'react';
import { useParams } from 'react-router';
import IstioConfigNewPage from 'pages/IstioConfigNew/IstioConfigNewPage';

const IstioConfigNewRoute = () => {
  const objectType = useParams<string>();

  return <IstioConfigNewPage objectType={objectType}></IstioConfigNewPage>;
};

export default IstioConfigNewRoute;
