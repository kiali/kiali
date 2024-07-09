import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { ServiceId } from 'types/ServiceInfo';
import { ServiceDetailsPage } from 'pages/ServiceDetails/ServiceDetailsPage';

/**
 * ServiceDetails wrapper to add routing parameters to ServiceDetailsPage
 * Some platforms where Kiali is deployed reuse ServiceDetailsPage but
 * do not work with react-router params (like Openshift Console)
 */
export const ServiceDetailsRoute: React.FC = () => {
  const serviceId = useParams<ServiceId>() as ServiceId;

  return <ServiceDetailsPage serviceId={serviceId}></ServiceDetailsPage>;
};
