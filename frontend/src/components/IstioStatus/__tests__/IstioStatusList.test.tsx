import * as React from 'react';
import { render } from '@testing-library/react';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioStatusList } from '../IstioStatusList';
import { CLUSTER_DEFAULT } from '../../../types/Graph';

it('lists all the components grouped', () => {
  const components: ComponentStatus[] = [
    {
      cluster: CLUSTER_DEFAULT,
      name: 'grafana',
      status: Status.NotFound,
      isCore: false
    },
    {
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.Unhealthy,
      isCore: false
    },
    {
      cluster: CLUSTER_DEFAULT,
      name: 'istiod',
      status: Status.NotFound,
      isCore: true
    },
    {
      cluster: CLUSTER_DEFAULT,
      name: 'istio-egressgateway',
      status: Status.Unhealthy,
      isCore: true
    }
  ];

  const { container } = render(<IstioStatusList status={components} cluster={'Kubernetes'} />);
  expect(container).toMatchSnapshot();
});
