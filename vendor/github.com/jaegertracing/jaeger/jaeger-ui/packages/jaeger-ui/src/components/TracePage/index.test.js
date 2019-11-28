// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/* eslint-disable import/first */

jest.mock('./index.track');
jest.mock('./keyboard-shortcuts');
jest.mock('./scroll-page');
jest.mock('../../utils/filter-spans');
jest.mock('../../utils/update-ui-find');
// mock these to enable mount()
jest.mock('./TraceGraph/TraceGraph');
jest.mock('./TracePageHeader/SpanGraph');
jest.mock('./TracePageHeader/TracePageHeader.track');
jest.mock('./TracePageHeader/TracePageSearchBar');
jest.mock('./TraceTimelineViewer');

import React from 'react';
import sinon from 'sinon';
import { shallow, mount } from 'enzyme';

import {
  makeShortcutCallbacks,
  mapDispatchToProps,
  mapStateToProps,
  shortcutConfig,
  TracePageImpl as TracePage,
  VIEW_MIN_RANGE,
} from './index';
import * as track from './index.track';
import ArchiveNotifier from './ArchiveNotifier';
import { reset as resetShortcuts } from './keyboard-shortcuts';
import { cancel as cancelScroll } from './scroll-page';
import * as calculateTraceDagEV from './TraceGraph/calculateTraceDagEV';
import SpanGraph from './TracePageHeader/SpanGraph';
import TracePageHeader from './TracePageHeader';
import { trackSlimHeaderToggle } from './TracePageHeader/TracePageHeader.track';
import TraceTimelineViewer from './TraceTimelineViewer';
import ErrorMessage from '../common/ErrorMessage';
import LoadingIndicator from '../common/LoadingIndicator';
import * as getUiFindVertexKeys from '../TraceDiff/TraceDiffGraph/traceDiffGraphUtils';
import { fetchedState } from '../../constants';
import traceGenerator from '../../demo/trace-generators';
import transformTraceData from '../../model/transform-trace-data';
import filterSpansSpy from '../../utils/filter-spans';
import updateUiFindSpy from '../../utils/update-ui-find';

describe('makeShortcutCallbacks()', () => {
  let adjRange;

  beforeEach(() => {
    adjRange = jest.fn();
  });

  it('has props from `shortcutConfig`', () => {
    const callbacks = makeShortcutCallbacks(adjRange);
    expect(Object.keys(callbacks)).toEqual(Object.keys(shortcutConfig));
  });

  it('returns callbacsks that adjust the range based on the `shortcutConfig` values', () => {
    const fakeEvent = { preventDefault: () => {} };
    const callbacks = makeShortcutCallbacks(adjRange);
    Object.keys(shortcutConfig).forEach((key, i) => {
      callbacks[key](fakeEvent);
      expect(adjRange).toHaveBeenCalledTimes(i + 1);
      expect(adjRange).toHaveBeenLastCalledWith(...shortcutConfig[key]);
    });
  });
});

describe('<TracePage>', () => {
  TraceTimelineViewer.prototype.shouldComponentUpdate.mockReturnValue(false);

  const trace = transformTraceData(traceGenerator.trace({}));
  const defaultProps = {
    acknowledgeArchive: () => {},
    fetchTrace() {},
    focusUiFindMatches: jest.fn(),
    id: trace.traceID,
    history: {
      replace: () => {},
    },
    location: {
      search: null,
    },
    trace: { data: trace, state: fetchedState.DONE },
  };
  const notDefaultPropsId = `not ${defaultProps.id}`;

  let wrapper;

  beforeAll(() => {
    filterSpansSpy.mockReturnValue(new Set());
  });

  beforeEach(() => {
    wrapper = shallow(<TracePage {...defaultProps} />);
    filterSpansSpy.mockClear();
    updateUiFindSpy.mockClear();
  });

  describe('clearSearch', () => {
    it('calls updateUiFind with expected kwargs when clearing search', () => {
      expect(updateUiFindSpy).not.toHaveBeenCalled();
      wrapper.setProps({ id: notDefaultPropsId });
      expect(updateUiFindSpy).toHaveBeenCalledWith({
        history: defaultProps.history,
        location: defaultProps.location,
        trackFindFunction: track.trackFilter,
      });
    });

    it('blurs _searchBar.current when _searchBar.current exists', () => {
      const blur = jest.fn();
      wrapper.instance()._searchBar.current = {
        blur,
      };
      wrapper.setProps({ id: notDefaultPropsId });
      expect(blur).toHaveBeenCalledTimes(1);
    });

    it('handles null _searchBar.current', () => {
      expect(wrapper.instance()._searchBar.current).toBe(null);
      wrapper.setProps({ id: notDefaultPropsId });
    });
  });

  describe('viewing uiFind matches', () => {
    describe('focusUiFindMatches', () => {
      let trackFocusSpy;

      beforeAll(() => {
        trackFocusSpy = jest.spyOn(track, 'trackFocusMatches');
      });

      beforeEach(() => {
        defaultProps.focusUiFindMatches.mockReset();
        trackFocusSpy.mockReset();
      });

      it('calls props.focusUiFindMatches with props.trace.data and uiFind when props.trace.data is present', () => {
        const uiFind = 'test ui find';
        wrapper.setProps({ uiFind });
        wrapper.find(TracePageHeader).prop('focusUiFindMatches')();
        expect(defaultProps.focusUiFindMatches).toHaveBeenCalledWith(defaultProps.trace.data, uiFind);
        expect(trackFocusSpy).toHaveBeenCalledTimes(1);
      });

      it('handles when props.trace.data is absent', () => {
        const propFn = wrapper.find(TracePageHeader).prop('focusUiFindMatches');
        wrapper.setProps({ trace: {} });
        propFn();
        expect(defaultProps.focusUiFindMatches).not.toHaveBeenCalled();
        expect(trackFocusSpy).not.toHaveBeenCalled();
      });
    });

    describe('nextResult', () => {
      let trackNextSpy;

      beforeAll(() => {
        trackNextSpy = jest.spyOn(track, 'trackNextMatch');
      });

      beforeEach(() => {
        trackNextSpy.mockReset();
      });

      it('calls scrollToNextVisibleSpan and tracks it', () => {
        const scrollNextSpy = jest
          .spyOn(wrapper.instance()._scrollManager, 'scrollToNextVisibleSpan')
          .mockImplementation();
        wrapper.find(TracePageHeader).prop('nextResult')();
        expect(trackNextSpy).toHaveBeenCalledTimes(1);
        expect(scrollNextSpy).toHaveBeenCalledTimes(1);
      });
    });

    describe('prevResult', () => {
      let trackPrevSpy;

      beforeAll(() => {
        trackPrevSpy = jest.spyOn(track, 'trackPrevMatch');
      });

      beforeEach(() => {
        trackPrevSpy.mockReset();
      });

      it('calls scrollToPrevVisibleSpan and tracks it', () => {
        const scrollPrevSpy = jest
          .spyOn(wrapper.instance()._scrollManager, 'scrollToPrevVisibleSpan')
          .mockImplementation();
        wrapper.find(TracePageHeader).prop('prevResult')();
        expect(trackPrevSpy).toHaveBeenCalledTimes(1);
        expect(scrollPrevSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  it('uses props.uiFind, props.trace.traceID, and props.trace.spans.length to create filterSpans memo cache key', () => {
    expect(filterSpansSpy).toHaveBeenCalledTimes(0);

    const uiFind = 'uiFind';
    wrapper.setProps({ uiFind });
    // changing props.id is used to trigger renders without invalidating memo cache key
    wrapper.setProps({ id: notDefaultPropsId });
    expect(filterSpansSpy).toHaveBeenCalledTimes(1);
    expect(filterSpansSpy).toHaveBeenLastCalledWith(uiFind, defaultProps.trace.data.spans);

    const newTrace = { ...defaultProps.trace, traceID: `not-${defaultProps.trace.traceID}` };
    wrapper.setProps({ trace: newTrace });
    wrapper.setProps({ id: defaultProps.id });
    expect(filterSpansSpy).toHaveBeenCalledTimes(2);
    expect(filterSpansSpy).toHaveBeenLastCalledWith(uiFind, newTrace.data.spans);

    // Mutating props is not advised, but emulates behavior done somewhere else
    newTrace.data.spans.splice(0, newTrace.data.spans.length / 2);
    wrapper.setProps({ id: notDefaultPropsId });
    wrapper.setProps({ id: defaultProps.id });
    expect(filterSpansSpy).toHaveBeenCalledTimes(3);
    expect(filterSpansSpy).toHaveBeenLastCalledWith(uiFind, newTrace.data.spans);
  });

  it('renders a a loading indicator when not provided a fetched trace', () => {
    wrapper.setProps({ trace: null });
    const loading = wrapper.find(LoadingIndicator);
    expect(loading.length).toBe(1);
  });

  it('renders an error message when given an error', () => {
    wrapper.setProps({ trace: new Error('some-error') });
    expect(wrapper.find(ErrorMessage).length).toBe(1);
  });

  it('renders a loading indicator when loading', () => {
    wrapper.setProps({ trace: null, loading: true });
    const loading = wrapper.find(LoadingIndicator);
    expect(loading.length).toBe(1);
  });

  it('forces lowercase id', () => {
    const replaceMock = jest.fn();
    const props = {
      ...defaultProps,
      id: trace.traceID.toUpperCase(),
      history: {
        replace: replaceMock,
      },
    };
    shallow(<TracePage {...props} />);
    expect(replaceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: expect.stringContaining(trace.traceID),
      })
    );
  });

  it('focuses on search bar when there is a search bar and focusOnSearchBar is called', () => {
    const focus = jest.fn();
    wrapper.instance()._searchBar.current = {
      focus,
    };
    wrapper.instance().focusOnSearchBar();
    expect(focus).toHaveBeenCalledTimes(1);
  });

  it('handles absent search bar when there is not a search bar and focusOnSearchBar is called', () => {
    expect(wrapper.instance()._searchBar.current).toBe(null);
    wrapper.instance().focusOnSearchBar();
  });

  it('fetches the trace if necessary', () => {
    const fetchTrace = sinon.spy();
    wrapper = mount(<TracePage {...defaultProps} trace={null} fetchTrace={fetchTrace} />);
    expect(fetchTrace.called).toBeTruthy();
    expect(fetchTrace.calledWith(trace.traceID)).toBe(true);
  });

  it("doesn't fetch the trace if already present", () => {
    const fetchTrace = sinon.spy();
    wrapper = mount(<TracePage {...defaultProps} fetchTrace={fetchTrace} />);
    expect(fetchTrace.called).toBeFalsy();
  });

  it('resets the view range when the trace changes', () => {
    const altTrace = { ...trace, traceID: 'some-other-id' };
    // mount because `.componentDidUpdate()`
    wrapper = mount(<TracePage {...defaultProps} />);
    wrapper.setState({ viewRange: { time: [0.2, 0.8] } });
    wrapper.setProps({ id: altTrace.traceID, trace: { data: altTrace, state: fetchedState.DONE } });
    expect(wrapper.state('viewRange')).toEqual({ time: { current: [0, 1] } });
  });

  it('updates _scrollManager when recieving props', () => {
    wrapper = shallow(<TracePage {...defaultProps} trace={null} />);
    const scrollManager = wrapper.instance()._scrollManager;
    scrollManager.setTrace = jest.fn();
    wrapper.setProps({ trace: { data: trace } });
    expect(scrollManager.setTrace.mock.calls).toEqual([[trace]]);
  });

  it('performs misc cleanup when unmounting', () => {
    resetShortcuts.mockReset();
    wrapper = shallow(<TracePage {...defaultProps} trace={null} />);
    const scrollManager = wrapper.instance()._scrollManager;
    scrollManager.destroy = jest.fn();
    wrapper.unmount();
    expect(scrollManager.destroy.mock.calls).toEqual([[]]);
    expect(resetShortcuts.mock.calls).toEqual([[], []]);
    expect(cancelScroll.mock.calls).toEqual([[]]);
  });

  describe('TracePageHeader props', () => {
    describe('canCollapse', () => {
      it('is true if !embedded', () => {
        expect(wrapper.find(TracePageHeader).prop('canCollapse')).toBe(true);
      });

      it('is true if either of embedded.timeline.hideSummary and embedded.timeline.hideMinimap are false', () => {
        [true, false].forEach(hideSummary => {
          [true, false].forEach(hideMinimap => {
            const embedded = {
              timeline: {
                hideSummary,
                hideMinimap,
              },
            };
            wrapper.setProps({ embedded });
            expect(wrapper.find(TracePageHeader).prop('canCollapse')).toBe(!hideSummary || !hideMinimap);
          });
        });
      });
    });

    describe('calculates hideMap correctly', () => {
      it('is true if on traceGraphView', () => {
        wrapper.instance().traceDagEV = { vertices: [], nodes: [] };
        wrapper.setState({ traceGraphView: true });
        expect(wrapper.find(TracePageHeader).prop('hideMap')).toBe(true);
      });

      it('is true if embedded indicates it should be', () => {
        wrapper.setProps({
          embedded: {
            timeline: {
              hideMinimap: false,
            },
          },
        });
        expect(wrapper.find(TracePageHeader).prop('hideMap')).toBe(false);
        wrapper.setProps({
          embedded: {
            timeline: {
              hideMinimap: true,
            },
          },
        });
        expect(wrapper.find(TracePageHeader).prop('hideMap')).toBe(true);
      });
    });

    describe('calculates hideSummary correctly', () => {
      it('is false if embedded is not provided', () => {
        expect(wrapper.find(TracePageHeader).prop('hideSummary')).toBe(false);
      });

      it('is true if embedded indicates it should be', () => {
        wrapper.setProps({
          embedded: {
            timeline: {
              hideSummary: false,
            },
          },
        });
        expect(wrapper.find(TracePageHeader).prop('hideSummary')).toBe(false);
        wrapper.setProps({
          embedded: {
            timeline: {
              hideSummary: true,
            },
          },
        });
        expect(wrapper.find(TracePageHeader).prop('hideSummary')).toBe(true);
      });
    });

    describe('showArchiveButton', () => {
      it('is true when not embedded and archive is enabled', () => {
        [{ timeline: {} }, undefined].forEach(embedded => {
          [true, false].forEach(archiveEnabled => {
            wrapper.setProps({ embedded, archiveEnabled });
            expect(wrapper.find(TracePageHeader).prop('showArchiveButton')).toBe(!embedded && archiveEnabled);
          });
        });
      });
    });

    describe('resultCount', () => {
      let getUiFindVertexKeysSpy;

      beforeAll(() => {
        getUiFindVertexKeysSpy = jest.spyOn(getUiFindVertexKeys, 'getUiFindVertexKeys');
      });

      beforeEach(() => {
        getUiFindVertexKeysSpy.mockReset();
      });

      it('is the size of spanFindMatches when available', () => {
        expect(wrapper.find(TracePageHeader).prop('resultCount')).toBe(0);

        const size = 20;
        filterSpansSpy.mockReturnValueOnce({ size });
        wrapper.setProps({ uiFind: 'new ui find to bust memo' });
        expect(wrapper.find(TracePageHeader).prop('resultCount')).toBe(size);
      });

      it('is the size of graphFindMatches when available', () => {
        expect(wrapper.find(TracePageHeader).prop('resultCount')).toBe(0);

        const size = 30;
        getUiFindVertexKeysSpy.mockReturnValueOnce({ size });
        wrapper.setState({ traceGraphView: true });
        wrapper.setProps({ uiFind: 'new ui find to bust memo' });
        expect(wrapper.find(TracePageHeader).prop('resultCount')).toBe(size);
      });

      it('defaults to 0', () => {
        // falsy uiFind for base case
        wrapper.setProps({ uiFind: '' });
        expect(wrapper.find(TracePageHeader).prop('resultCount')).toBe(0);

        filterSpansSpy.mockReturnValueOnce(null);
        wrapper.setProps({ uiFind: 'truthy uiFind' });
        expect(wrapper.find(TracePageHeader).prop('resultCount')).toBe(0);

        wrapper.setState({ traceGraphView: true });
        expect(wrapper.find(TracePageHeader).prop('resultCount')).toBe(0);
      });
    });

    describe('isEmbedded derived props', () => {
      it('toggles derived props when embedded is provided', () => {
        expect(wrapper.find(TracePageHeader).props()).toEqual(
          expect.objectContaining({
            showShortcutsHelp: true,
            showStandaloneLink: false,
            showViewOptions: true,
          })
        );

        wrapper.setProps({ embedded: { timeline: {} } });
        expect(wrapper.find(TracePageHeader).props()).toEqual(
          expect.objectContaining({
            showShortcutsHelp: false,
            showStandaloneLink: true,
            showViewOptions: false,
          })
        );
      });
    });
  });

  describe('_adjustViewRange()', () => {
    let instance;
    let time;
    let state;

    const cases = [
      {
        message: 'stays within the [0, 1] range',
        timeViewRange: [0, 1],
        change: [-0.1, 0.1],
        result: [0, 1],
      },
      {
        message: 'start does not exceed 0.99',
        timeViewRange: [0, 1],
        change: [0.991, 0],
        result: [0.99, 1],
      },
      {
        message: 'end remains greater than 0.01',
        timeViewRange: [0, 1],
        change: [0, -0.991],
        result: [0, 0.01],
      },
      {
        message: `maintains a range of at least ${VIEW_MIN_RANGE} when panning left`,
        timeViewRange: [0.495, 0.505],
        change: [-0.001, -0.005],
        result: [0.494, 0.504],
      },
      {
        message: `maintains a range of at least ${VIEW_MIN_RANGE} when panning right`,
        timeViewRange: [0.495, 0.505],
        change: [0.005, 0.001],
        result: [0.5, 0.51],
      },
      {
        message: `maintains a range of at least ${VIEW_MIN_RANGE} when contracting`,
        timeViewRange: [0.495, 0.505],
        change: [0.1, -0.1],
        result: [0.495, 0.505],
      },
    ];

    beforeEach(() => {
      wrapper = shallow(<TracePage {...defaultProps} />);
      instance = wrapper.instance();
      time = { current: null };
      state = { viewRange: { time } };
    });

    cases.forEach(testCase => {
      const { message, timeViewRange, change, result } = testCase;
      it(message, () => {
        time.current = timeViewRange;
        wrapper.setState(state);
        instance._adjustViewRange(...change);
        const { current } = wrapper.state('viewRange').time;
        expect(current).toEqual(result);
      });
    });
  });

  describe('Archive', () => {
    it('renders ArchiveNotifier if props.archiveEnabled is true', () => {
      expect(wrapper.find(ArchiveNotifier).length).toBe(0);
      wrapper.setProps({ archiveEnabled: true });
      expect(wrapper.find(ArchiveNotifier).length).toBe(1);
    });

    it('calls props.acknowledgeArchive when ArchiveNotifier acknowledges', () => {
      const acknowledgeArchive = jest.fn();
      wrapper.setProps({ acknowledgeArchive, archiveEnabled: true });
      wrapper.find(ArchiveNotifier).prop('acknowledge')();
      expect(acknowledgeArchive).toHaveBeenCalledWith(defaultProps.id);
    });

    it("calls props.archiveTrace when TracePageHeader's archive button is clicked", () => {
      const archiveTrace = jest.fn();
      wrapper.setProps({ archiveTrace });
      wrapper.find(TracePageHeader).prop('onArchiveClicked')();
      expect(archiveTrace).toHaveBeenCalledWith(defaultProps.id);
    });
  });

  describe('manages various UI state', () => {
    let header;
    let spanGraph;
    let timeline;
    let calculateTraceDagEVSpy;

    function refreshWrappers() {
      header = wrapper.find(TracePageHeader);
      spanGraph = wrapper.find(SpanGraph);
      timeline = wrapper.find(TraceTimelineViewer);
    }

    beforeAll(() => {
      calculateTraceDagEVSpy = jest.spyOn(calculateTraceDagEV, 'default');
    });

    beforeEach(() => {
      wrapper = mount(<TracePage {...defaultProps} />);
      // use the method directly because it is a `ref` prop
      wrapper.instance().setHeaderHeight({ clientHeight: 1 });
      wrapper.update();
      refreshWrappers();
    });

    it('propagates headerHeight changes', () => {
      const h = 100;
      const { setHeaderHeight } = wrapper.instance();
      // use the method directly because it is a `ref` prop
      setHeaderHeight({ clientHeight: h });
      wrapper.update();
      let sections = wrapper.find('section');
      expect(sections.length).toBe(1);
      const section = sections.first();
      expect(section.prop('style')).toEqual({ paddingTop: h });
      expect(section.containsMatchingElement(<TraceTimelineViewer />)).toBe(true);
      setHeaderHeight(null);
      wrapper.update();
      sections = wrapper.find('section');
      expect(sections.length).toBe(0);
    });

    it('initializes slimView correctly', () => {
      expect(wrapper.state('slimView')).toBe(false);
      // Empty trace avoids this spec from evaluating TracePageHeader's consumption of slimView
      wrapper = mount(
        <TracePage {...defaultProps} trace={{}} embedded={{ timeline: { collapseTitle: true } }} />
      );
      expect(wrapper.state('slimView')).toBe(true);
    });

    it('propagates slimView changes', () => {
      const { onSlimViewClicked } = header.props();
      expect(header.prop('slimView')).toBe(false);
      expect(spanGraph.type()).toBeDefined();
      onSlimViewClicked(true);
      wrapper.update();
      refreshWrappers();
      expect(header.prop('slimView')).toBe(true);
      expect(spanGraph.length).toBe(0);
    });

    it('propagates textFilter changes', () => {
      const s = 'abc';
      expect(header.prop('textFilter')).toBeUndefined();
      wrapper.setProps({ uiFind: s });
      refreshWrappers();
      expect(header.prop('textFilter')).toBe(s);
    });

    it('propagates traceGraphView changes', () => {
      const { onTraceGraphViewClicked } = header.props();
      expect(header.prop('traceGraphView')).toBe(false);
      onTraceGraphViewClicked();
      wrapper.update();
      refreshWrappers();
      expect(header.prop('traceGraphView')).toBe(true);
      expect(calculateTraceDagEVSpy).toHaveBeenCalledWith(defaultProps.trace.data);

      wrapper.setProps({ trace: {} });
      onTraceGraphViewClicked();
      expect(calculateTraceDagEVSpy).toHaveBeenCalledTimes(1);
    });

    it('propagates viewRange changes', () => {
      const viewRange = {
        time: { current: [0, 1] },
      };
      const cursor = 123;
      const current = [0.25, 0.75];
      const { updateViewRangeTime, updateNextViewRangeTime } = spanGraph.props();
      expect(spanGraph.prop('viewRange')).toEqual(viewRange);
      expect(timeline.prop('viewRange')).toEqual(viewRange);
      updateNextViewRangeTime({ cursor });
      wrapper.update();
      refreshWrappers();
      viewRange.time.cursor = cursor;
      expect(spanGraph.prop('viewRange')).toEqual(viewRange);
      expect(timeline.prop('viewRange')).toEqual(viewRange);
      updateViewRangeTime(...current);
      wrapper.update();
      refreshWrappers();
      viewRange.time = { current };
      expect(spanGraph.prop('viewRange')).toEqual(viewRange);
      expect(timeline.prop('viewRange')).toEqual(viewRange);
    });
  });

  describe('GA tracking', () => {
    let header;
    let spanGraph;

    function refreshWrappers() {
      header = wrapper.find(TracePageHeader);
      spanGraph = wrapper.find(SpanGraph);
    }

    beforeEach(() => {
      wrapper = mount(<TracePage {...defaultProps} />);
      // use the method directly because it is a `ref` prop
      wrapper.instance().setHeaderHeight({ clientHeight: 1 });
      wrapper.update();
      refreshWrappers();
    });

    it('tracks setting the header to slim-view', () => {
      const { onSlimViewClicked } = header.props();
      trackSlimHeaderToggle.mockReset();
      onSlimViewClicked(true);
      onSlimViewClicked(false);
      expect(trackSlimHeaderToggle.mock.calls).toEqual([[true], [false]]);
    });

    it('tracks changes to the viewRange', () => {
      const src = 'some-source';
      const { updateViewRangeTime } = spanGraph.props();
      track.trackRange.mockClear();
      const range = [0.25, 0.75];
      updateViewRangeTime(...range, src);
      expect(track.trackRange.mock.calls).toEqual([[src, range, [0, 1]]]);
    });
  });
});

describe('mapDispatchToProps()', () => {
  it('creates the actions correctly', () => {
    expect(mapDispatchToProps(() => {})).toEqual({
      acknowledgeArchive: expect.any(Function),
      archiveTrace: expect.any(Function),
      fetchTrace: expect.any(Function),
      focusUiFindMatches: expect.any(Function),
    });
  });
});

describe('mapStateToProps()', () => {
  const traceID = 'trace-id';
  const trace = {};
  const embedded = 'a-faux-embedded-config';
  const ownProps = {
    match: {
      params: { id: traceID },
    },
  };
  let state;
  beforeEach(() => {
    state = {
      embedded,
      trace: {
        traces: {
          [traceID]: { data: trace, state: fetchedState.DONE },
        },
      },
      router: {
        location: {
          search: '',
        },
      },
      config: {
        archiveEnabled: false,
      },
      archive: {},
    };
  });
  it('maps state to props correctly', () => {
    const props = mapStateToProps(state, ownProps);
    expect(props).toEqual({
      id: traceID,
      embedded,
      archiveEnabled: false,
      archiveTraceState: undefined,
      searchUrl: null,
      trace: { data: {}, state: fetchedState.DONE },
    });
  });

  it('handles falsy ownProps.match.params.id', () => {
    const props = mapStateToProps(state, {
      match: {
        params: {
          id: '',
        },
      },
    });
    expect(props).toEqual(
      expect.objectContaining({
        archiveTraceState: null,
        id: '',
        trace: null,
      })
    );
  });

  it('propagates fromSearch correctly', () => {
    const fakeUrl = 'fake-url';
    state.router.location.state = { fromSearch: fakeUrl };
    const props = mapStateToProps(state, ownProps);
    expect(props).toEqual({
      id: traceID,
      embedded,
      archiveEnabled: false,
      archiveTraceState: undefined,
      searchUrl: fakeUrl,
      trace: { data: {}, state: fetchedState.DONE },
    });
  });
});
