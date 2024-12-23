import * as React from 'react';
// import { useParams } from 'react-router-dom-v5-compat';
// import { ServiceId } from 'types/ServiceInfo';
import { ServiceWizardPage } from 'pages/IstioConfigNew/ServiceWizardPage';
import * as API from '../services/Api';
// import { ErrorMsg } from 'types/ErrorMsg';
import * as AlertUtils from '../utils/AlertUtils';
import { useParams } from 'react-router-dom-v5-compat';
import { useState } from 'react';
import { createConnection } from 'net';



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
  const { namespace, service, /*wizardType*/} = useParams<ServiceWizardPathProps>();

  const serviceId = { namespace: namespace!, service: service! };

const [serviceDetails, setServiceDetails ]= useState<any>(undefined)


function ({ roomId }) {
const [serverUrl] = useState('routes/ServiceWizardRoute');

React.useEffect(() => {
  const connection = createConnection(serverUrl, roomId);
  connection.connect();

  return () => {
    connection.disconnect();
  };
}, 
[serverUrl, roomId]);
}

  API.getServiceDetail(
    serviceId.namespace,
    serviceId.service,
    true,
    "",
    30
  )
    .then(results => {
      setServiceDetails(
        results,
      );
    })
    .catch(error => {
      AlertUtils.addError('Could not fetch Service Details.', error);
      // const msg: ErrorMsg = {
      //   title: 'No Service is selected',
      //   description: `${serviceId.service} is not found in the mesh`
      // };
      // setState({error: msg });
    });

  // return <ServiceWizardPage serviceId={serviceId} wizardType={wizardType!} ></ServiceWizardPage>;
  if (serviceDetails === undefined){
    return (<p>
      'Loading'
    </p>);

  }else{
    return <ServiceWizardPage workloads={serviceDetails.workloads} objectGVK={function (_: any): unknown {
      throw new Error('Function not implemented.');
    } } gateways={[]} istioAPIEnabled={false}/>;
  };
};
