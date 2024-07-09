import { shallow } from 'enzyme';
import { ControlPlaneBadge } from '../ControlPlaneBadge';
import { MemoryRouter } from 'react-router-dom-v5-compat';

describe('ControlPlaneBadge', () => {
  const controlPlaneAnnotation = 'topology.istio.io/controlPlaneClusters';

  it('does not show istio status for remote clusters', () => {
    const wrapper = shallow(
      <MemoryRouter>
        <ControlPlaneBadge annotations={{ [controlPlaneAnnotation]: 'primary' }} cluster="remote" />
      </MemoryRouter>
    );

    expect(wrapper.find('IstioStatus').exists()).toBeFalsy();
  });
});
