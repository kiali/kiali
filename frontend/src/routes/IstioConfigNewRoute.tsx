import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { IstioConfigNewPage } from 'pages/IstioConfigNew/IstioConfigNewPage';

/**
 * IstioConfigNew wrapper to add routing parameters to IstioConfigNewPage
 * Some platforms where Kiali is deployed reuse IstioConfigNewPage but
 * do not work with react-router params (like Openshift Console)
 */
export const IstioConfigNewRoute: React.FC = () => {
  const { objectGroup, objectVersion, objectKind } = useParams<{
    objectGroup: string;
    objectKind: string;
    objectVersion: string;
  }>();

  return (
    <IstioConfigNewPage
      objectGroup={objectGroup!}
      objectVersion={objectVersion!}
      objectKind={objectKind!}
    ></IstioConfigNewPage>
  );
};
