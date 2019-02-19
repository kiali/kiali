import * as React from 'react';
import { shallow } from 'enzyme';
import { JaegerToolbar } from '../JaegerToolbar';
import { FormControl } from 'patternfly-react';
import RightToolbar from '../RightToolbar';

describe('LookBack', () => {
  let wrapper, requestSearchURL, setGraph, setDetails, setMinimap;
  beforeEach(() => {
    requestSearchURL = jest.fn();
    setGraph = jest.fn();
    setDetails = jest.fn();
    setMinimap = jest.fn();
    const props = {
      disableSelector: false,
      tagsValue: '',
      showGraph: false,
      showSummary: false,
      showMinimap: false,
      disabled: false,
      limit: 0,
      requestSearchURL: requestSearchURL,
      setGraph: setGraph,
      setDetails: setDetails,
      setMinimap: setMinimap
    };
    wrapper = shallow(<JaegerToolbar {...props} />);
  });

  it('renders JaegerToolbar correctly', () => {
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  it('renders JaegerToolbar correctly without namespace selector', () => {
    wrapper.setProps({ disableSelector: true });
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });

  describe('Form', () => {
    it('FormControl should be disabled', () => {
      wrapper.find(FormControl).forEach(f => {
        expect(f.props()['disabled']).toBeFalsy();
      });
      wrapper.setProps({ disabled: true });
      wrapper.find(FormControl).forEach(f => {
        expect(f.props()['disabled']).toBeTruthy();
      });
    });
  });

  describe('RightToolbar', () => {
    it('RightToolbar onGraphClick should be setGraph', () => {
      expect(
        wrapper
          .find(RightToolbar)
          .first()
          .props()['onGraphClick']
      ).toBe(setGraph);
    });

    it('RightToolbar onSummaryClick should be setDetails', () => {
      expect(
        wrapper
          .find(RightToolbar)
          .first()
          .props()['onSummaryClick']
      ).toBe(setDetails);
    });

    it('RightToolbar onMinimapClick should be setMinimap', () => {
      expect(
        wrapper
          .find(RightToolbar)
          .first()
          .props()['onMinimapClick']
      ).toBe(setMinimap);
    });

    it('RightToolbar should be disabled', () => {
      expect(
        wrapper
          .find(RightToolbar)
          .first()
          .props()['disabled']
      ).toBeFalsy();
      wrapper.setProps({ disabled: true });
      expect(
        wrapper
          .find(RightToolbar)
          .first()
          .props()['disabled']
      ).toBeTruthy();
    });

    it('RightToolbar should have the buttons true or false', () => {
      const cases = [
        { showGraph: true, showSummary: false, showMinimap: false },
        { showGraph: true, showSummary: false, showMinimap: true },
        { showGraph: true, showSummary: true, showMinimap: false },
        { showGraph: false, showSummary: true, showMinimap: true }
      ];
      cases.forEach(useCase => {
        wrapper.setProps(useCase);
        expect(
          wrapper
            .find(RightToolbar)
            .first()
            .props()['graph']
        ).toEqual(useCase.showGraph);
        expect(
          wrapper
            .find(RightToolbar)
            .first()
            .props()['minimap']
        ).toEqual(useCase.showMinimap);
        expect(
          wrapper
            .find(RightToolbar)
            .first()
            .props()['summary']
        ).toEqual(useCase.showSummary);
      });
    });
  });
});
