import { shallow } from 'enzyme';
import { ControlPlaneBadge } from '../ControlPlaneBadge';
import { MemoryRouter } from 'react-router-dom-v5-compat';

describe('ControlPlaneBadge', () => {

  it('does not show istio status for remote clusters', () => {
    const wrapper = shallow(
      <MemoryRouter>
        <ControlPlaneBadge />
      </MemoryRouter>
    );

    expect(wrapper.find('IstioStatus').exists()).toBeFalsy();
  });
});
