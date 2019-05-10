import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceDropdown } from '../ServiceDropdown';

describe('NamespaceDropdown', () => {
  let wrapper, setService;
  beforeEach(() => {
    setService = jest.fn();
    wrapper = shallow(<ServiceDropdown setService={setService} service={''} activeNamespaces={[]} disabled={false} />);
  });

  it('renders ServiceDropdown correctly without custom', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
