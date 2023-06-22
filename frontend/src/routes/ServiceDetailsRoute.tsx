import * as React from 'react';
import { useParams } from 'react-router';
import ServiceId from 'types/ServiceId';
import ServiceDetailsPage from 'pages/ServiceDetails/ServiceDetailsPage';

const ServiceDetailsRoute = () => {
  const serviceId = useParams<ServiceId>();

  return <ServiceDetailsPage serviceId={serviceId}></ServiceDetailsPage>;
};

export default ServiceDetailsRoute;
