import * as React from 'react';
import { shallow } from 'enzyme';
import { ServiceDropdown } from '../ServiceDropdown';
import { shallowToJson } from 'enzyme-to-json';

describe('NamespaceDropdown', () => {
  let wrapper, setService;
  beforeEach(() => {
    setService = jest.fn();
    wrapper = shallow(<ServiceDropdown setService={setService} service={''} activeNamespaces={[]} disabled={false} />);
  });

  it('renders ServiceDropdown correctly without custom', () => {
    expect(shallowToJson(wrapper)).toBeDefined();
    expect(shallowToJson(wrapper)).toMatchSnapshot();
  });
});
