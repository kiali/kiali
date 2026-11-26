// Assisted-by: Codex
import * as React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Visualization } from '@patternfly/react-topology';
import { store } from 'store/ConfigStore';
import { GraphFindComponent } from '../GraphFind';
import { graphLayout } from 'pages/Graph/Graph';
import { EdgeMode, LayoutType, NodeAttr } from 'types/Graph';
import { setObserved } from 'helpers/GraphHelpers';

rstest.mock('pages/Graph/Graph', () => ({ graphLayout: rstest.fn() }));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={store}>{children}</Provider>
);

const createProps = (): React.ComponentProps<typeof GraphFindComponent> => {
  const controller = new Visualization();
  controller.fromModel({
    graph: { id: 'graph', type: 'graph', data: { graphData: { elementsChanged: false } } },
    nodes: [
      { id: 'source', type: 'node', width: 40, height: 40, data: { id: 'source', httpIn: 10 } },
      { id: 'target', type: 'node', width: 40, height: 40, data: { id: 'target', httpIn: 0 } }
    ],
    edges: [{ id: 'edge', type: 'edge', source: 'source', target: 'target', data: {} }]
  });
  return {
    controller,
    edgeLabels: [],
    edgeMode: EdgeMode.ALL,
    findValue: '',
    hideValue: '',
    rankBy: [],
    setEdgeLabels: rstest.fn(),
    setFindValue: rstest.fn(),
    setHideValue: rstest.fn(),
    setRankBy: rstest.fn(),
    showIdleNodes: false,
    showRank: false,
    showSecurity: false,
    showVirtualServices: false,
    toggleGraphSecurity: rstest.fn(),
    toggleGraphVirtualServices: rstest.fn(),
    toggleIdleNodes: rstest.fn(),
    toggleRank: rstest.fn(),
    updateTime: 1
  };
};

describe('Graph find/hide after refresh', () => {
  beforeEach(() => {
    rstest.mocked(graphLayout).mockClear();
  });

  it.each([
    { hideValue: 'httpin > 5', edgeMode: EdgeMode.ALL },
    { hideValue: 'name contains prom', edgeMode: EdgeMode.ALL },
    { hideValue: '', edgeMode: EdgeMode.NONE },
    { hideValue: '', edgeMode: EdgeMode.UNHEALTHY }
  ])('preserves the viewport when refreshing with $hideValue / $edgeMode', filter => {
    const props = { ...createProps(), ...filter };
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<GraphFindComponent {...props} updateTime={2} />);

    expect(graphLayout).toHaveBeenCalledWith(props.controller, LayoutType.LayoutNoFit, false);
  });

  it('reapplies a rate-based hide expression to refreshed data', () => {
    const props = { ...createProps(), hideValue: 'httpin > 5' };
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    const source = props.controller.getElementById('source')!;
    rerender(<GraphFindComponent {...props} updateTime={2} />);
    expect(source.isVisible()).toBe(false);

    setObserved(() => source.setData({ ...source.getData(), httpIn: 0 }));
    rerender(<GraphFindComponent {...props} updateTime={3} />);

    expect(source.isVisible()).toBe(true);
    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.LayoutNoFit, false);
  });

  it('still reapplies Find after refreshed node data is available', () => {
    const props = { ...createProps(), findValue: 'httpin > 5' };
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    const source = props.controller.getElementById('source')!;
    rerender(<GraphFindComponent {...props} updateTime={2} />);
    expect(source.getData().isFind).toBe(true);

    setObserved(() => source.setData({ ...source.getData(), httpIn: 0 }));
    rerender(<GraphFindComponent {...props} updateTime={3} />);

    expect(source.getData().isFind).toBe(false);
    expect(graphLayout).not.toHaveBeenCalled();
  });

  it('still fits the graph when the user changes the hide expression', () => {
    const props = createProps();
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<GraphFindComponent {...props} hideValue="httpin > 5" />);

    expect(graphLayout).toHaveBeenCalledWith(props.controller, LayoutType.Layout, true);
  });

  it('still fits the graph when the user changes the edge mode', () => {
    const props = createProps();
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<GraphFindComponent {...props} edgeMode={EdgeMode.NONE} />);

    expect(graphLayout).toHaveBeenCalledWith(props.controller, LayoutType.Layout, true);
  });

  it('does not relayout an unfiltered graph on refresh', () => {
    const props = createProps();
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<GraphFindComponent {...props} updateTime={2} />);

    expect(graphLayout).not.toHaveBeenCalled();
  });
});

describe('Graph find/hide reset boundaries', () => {
  const createFilteredProps = (): React.ComponentProps<typeof GraphFindComponent> => ({
    ...createProps(),
    hideValue: 'httpin > 5'
  });

  beforeEach(() => {
    rstest.mocked(graphLayout).mockClear();
  });

  it('still resets and fits when the applied model has a topology change', () => {
    const props = createFilteredProps();
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    setObserved(() => props.controller.getGraph().setData({ graphData: { elementsChanged: true } }));

    rerender(<GraphFindComponent {...props} updateTime={2} />);

    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.Layout, true);
  });

  it('hides newly added matching nodes before requesting the final fit', () => {
    const props = createFilteredProps();
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    const model = props.controller.toModel();
    model.graph!.data = { graphData: { elementsChanged: true } };
    model.nodes!.push({ id: 'added', type: 'node', width: 40, height: 40, data: { httpIn: 10 } });
    props.controller.fromModel(model);

    rerender(<GraphFindComponent {...props} updateTime={2} />);

    expect(props.controller.getElementById('added')!.isVisible()).toBe(false);
    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.Layout, true);
  });

  it('does not treat a stale topology flag as a new model update', () => {
    const props = { ...createFilteredProps(), edgeMode: EdgeMode.NONE };
    setObserved(() => props.controller.getGraph().setData({ graphData: { elementsChanged: true } }));
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<GraphFindComponent {...props} findValue="httpin > 5" />);

    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.LayoutNoFit, false);
  });

  it('still resets and fits when a controller first becomes available', () => {
    const props = createFilteredProps();
    const { rerender } = render(<GraphFindComponent {...props} controller={undefined!} />, { wrapper: Wrapper });

    rerender(<GraphFindComponent {...props} />);

    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.Layout, true);
  });

  it('still resets and fits when replacing the controller', () => {
    const props = createFilteredProps();
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    const replacement = createFilteredProps().controller;

    rerender(<GraphFindComponent {...props} controller={replacement} />);

    expect(graphLayout).toHaveBeenLastCalledWith(replacement, LayoutType.Layout, true);
  });

  it('restores hidden elements and fits when clearing Hide', () => {
    const props = createFilteredProps();
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    rerender(<GraphFindComponent {...props} updateTime={2} />);
    expect(props.controller.getElementById('source')!.isVisible()).toBe(false);

    rerender(<GraphFindComponent {...props} hideValue="" updateTime={3} />);

    expect(props.controller.getElementById('source')!.isVisible()).toBe(true);
    expect(props.controller.getElementById('edge')!.isVisible()).toBe(true);
    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.Layout, true);
  });

  it('restores all edges and fits when clearing the edge filter', () => {
    const props = { ...createFilteredProps(), hideValue: '', edgeMode: EdgeMode.NONE };
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    rerender(<GraphFindComponent {...props} updateTime={2} />);
    expect(props.controller.getElementById('edge')!.isVisible()).toBe(false);

    rerender(<GraphFindComponent {...props} edgeMode={EdgeMode.ALL} updateTime={3} />);

    expect(props.controller.getElementById('edge')!.isVisible()).toBe(true);
    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.Layout, true);
  });

  it('reapplies the unhealthy-edge filter when health changes', () => {
    const props = { ...createFilteredProps(), hideValue: '', edgeMode: EdgeMode.UNHEALTHY };
    const { rerender } = render(<GraphFindComponent {...props} />, { wrapper: Wrapper });
    const edge = props.controller.getElementById('edge')!;
    rerender(<GraphFindComponent {...props} updateTime={2} />);
    expect(edge.isVisible()).toBe(false);

    setObserved(() => edge.setData({ [NodeAttr.healthStatus]: 'DEGRADED' }));
    rerender(<GraphFindComponent {...props} updateTime={3} />);

    expect(edge.isVisible()).toBe(true);
    expect(graphLayout).toHaveBeenLastCalledWith(props.controller, LayoutType.LayoutNoFit, false);
  });
});
