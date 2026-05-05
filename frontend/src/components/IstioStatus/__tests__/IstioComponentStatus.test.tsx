import * as React from 'react';
import { render } from '@testing-library/react';
import { ComponentStatus, Status } from '../../../types/IstioStatus';
import { IstioComponentStatus } from '../IstioComponentStatus';
import { CLUSTER_DEFAULT } from '../../../types/Graph';

const renderComponent = (cs: ComponentStatus): ReturnType<typeof render> => {
  return render(<IstioComponentStatus componentStatus={cs} />);
};

describe('IstioComponentStatus renders', () => {
  it('success icon when core component is running', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'isito-ingress',
      status: Status.Healthy,
      isCore: true
    });

    expect(container).toMatchSnapshot();
  });

  it('error icon when core component is not running', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'isito-ingress',
      status: Status.Unhealthy,
      isCore: true
    });

    expect(container).toMatchSnapshot();
  });

  it('error icon when core component is not found', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'isito-ingress',
      status: Status.NotFound,
      isCore: true
    });

    expect(container).toMatchSnapshot();
  });

  it('success icon when core component is running', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.Healthy,
      isCore: false
    });

    expect(container).toMatchSnapshot();
  });

  it('warning icon when core component is not running', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.Unhealthy,
      isCore: false
    });

    expect(container).toMatchSnapshot();
  });

  it('warning icon when core component is not found', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'prometheus',
      status: Status.NotFound,
      isCore: false
    });

    expect(container).toMatchSnapshot();
  });

  it('minus icon when core component is not ready', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'core',
      status: Status.NotReady,
      isCore: true
    });

    expect(container).toMatchSnapshot();
  });

  it('minus icon when addon component is not ready', () => {
    const { container } = renderComponent({
      cluster: CLUSTER_DEFAULT,
      name: 'addon',
      status: Status.NotReady,
      isCore: false
    });

    expect(container).toMatchSnapshot();
  });
});
