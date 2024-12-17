import * as React from 'react';
import { useParams } from 'react-router-dom-v5-compat';
import { ServiceId } from 'types/ServiceInfo';
import { ServiceWizardPage } from 'pages/IstioConfigNew/ServiceWizardPage';

export type ServiceWizardPathProps = {
  namespace: string;
  service: string;
  wizardType: string;
};

/**
 * ServiceWizard wrapper to add routing parameters to ServiceWizardPage
 * Some platforms where Kiali is deployed reuse ServiceWizardPage but
 * do not work with react-router params (like Openshift Console)
 */
export const ServiceWizardRoute: React.FC = () => {
  const { namespace, service, wizardType } = useParams<ServiceWizardPathProps>();

  const serviceId: ServiceId = { namespace: namespace!, service: service! };

  return <ServiceWizardPage serviceId={serviceId} wizardType={wizardType!}></ServiceWizardPage>;
};
