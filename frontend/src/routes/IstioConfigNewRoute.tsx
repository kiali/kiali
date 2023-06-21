import * as React from 'react';
import { useParams } from 'react-router';
import IstioConfigNewPage, { IstioConfigNewPageId } from 'pages/IstioConfigNew/IstioConfigNewPage';

const IstioConfigNewRoute = () => {
  const istioConfigNewPageId = useParams<IstioConfigNewPageId>();

  return <IstioConfigNewPage istioConfigNewPageId={istioConfigNewPageId}></IstioConfigNewPage>;
};

export default IstioConfigNewRoute;
