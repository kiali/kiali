import { shallow } from 'enzyme';
import { ControlPlaneBadge } from '../ControlPlaneBadge';

describe('ControlPlaneBadge', () => {
  const controlPlaneAnnotation = 'topology.istio.io/controlPlaneClusters';

  it('does not show istio status for remote clusters', () => {
    const wrapper = shallow(
      <ControlPlaneBadge annotations={{ [controlPlaneAnnotation]: 'primary' }} cluster="remote" />
    );

    expect(wrapper.find('IstioStatus').exists()).toBeFalsy();
  });
});
