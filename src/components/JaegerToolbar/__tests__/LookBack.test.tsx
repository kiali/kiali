import * as React from 'react';
import { shallow } from 'enzyme';
import { LookBack } from '../LookBack';
import { Form, FormGroup } from 'patternfly-react';
import ToolbarDropdown from '../../../components/ToolbarDropdown/ToolbarDropdown';

const lookBackOptions = {
  '1h': 'Last Hour',
  '2h': 'Last 2 Hours',
  '3h': 'Last 3 Hours',
  '6h': 'Last 6 Hours',
  '12h': 'Last 12 Hours',
  '24h': 'Last 24 Hours',
  '2d': 'Last 2 Days',
  custom: 'Custom Time Range'
};

describe('LookBack', () => {
  let wrapper, onChangeCustom, setLookback;

  beforeEach(() => {
    onChangeCustom = jest.fn();
    setLookback = jest.fn();
    wrapper = shallow(
      <LookBack onChangeCustom={onChangeCustom} setLookback={setLookback} fetching={false} lookback={''} />
    );
  });

  it('renders LookBack correctly without custom', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('renders Extra forms when lookback is custom', () => {
    expect(wrapper.find(Form).length).toEqual(0);
    wrapper.setProps({ lookback: 'custom' });
    expect(wrapper.find(Form).length).toEqual(1);
    expect(wrapper.find(FormGroup).length).toEqual(2);
  });

  it('LookBack has lookBackOptions options', () => {
    expect(wrapper.instance().lookBackOptions).toEqual(lookBackOptions);
  });

  it('disable ToolbarDropwdown if no namespaces', () => {
    expect(wrapper.find(ToolbarDropdown).length).toEqual(1);
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['disabled']
    ).toBeFalsy();
    wrapper.setProps({ fetching: true });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['disabled']
    ).toBeTruthy();
  });

  it('ToolbarDropdown has  lookBackOptions like options', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['options']
    ).toEqual(lookBackOptions);
  });

  it('ToolbarDropdown has 1h by defaut', () => {
    wrapper.setProps({ lookback: '1h' });
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['value']
    ).toEqual('1h');
  });

  it('ToolbarDropdown has setLookback like handleSelect', () => {
    expect(
      wrapper
        .find(ToolbarDropdown)
        .first()
        .props()['handleSelect']
    ).toBe(setLookback);
  });
});
