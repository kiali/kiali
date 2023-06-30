import * as React from 'react';
import { useParams } from 'react-router';
import { ServiceId } from 'types/ServiceId';
import { ServiceDetailsPage } from 'pages/ServiceDetails/ServiceDetailsPage';

/**
 * ServiceDetails wrapper to add routing parameters to ServiceDetailsPage
 * Some platforms where Kiali is deployed reuse ServiceDetailsPage but
 * do not work with react-router params (like Openshift Console)
 */
export const ServiceDetailsRoute = () => {
  const serviceId = useParams<ServiceId>();

  return <ServiceDetailsPage serviceId={serviceId}></ServiceDetailsPage>;
};
