import * as React from 'react';
import { shallow } from 'enzyme';
import { LookBack } from '../LookBack';

describe('LookBack', () => {
  let wrapper, setLookback;

  beforeEach(() => {
    setLookback = jest.fn();
    wrapper = shallow(<LookBack setLookback={setLookback} disabled={false} lookback={3600} />);
  });

  it('renders LookBack correctly without custom', () => {
    expect(wrapper).toBeDefined();
  });
});
