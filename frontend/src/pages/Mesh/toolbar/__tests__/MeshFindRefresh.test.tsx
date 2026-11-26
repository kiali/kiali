// Assisted-by: Codex
import * as React from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { Visualization } from '@patternfly/react-topology';
import { store } from 'store/ConfigStore';
import { MeshFindComponent } from '../MeshFind';
import { layoutMesh } from 'pages/Mesh/Mesh';
import { MeshLayout, MeshLayoutType } from 'pages/Mesh/layouts/LayoutFactory';
import { setObserved } from 'helpers/GraphHelpers';

rstest.mock('pages/Mesh/Mesh', () => ({ layoutMesh: rstest.fn() }));

const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Provider store={store}>{children}</Provider>
);

type ReadyMeshFindProps = React.ComponentProps<typeof MeshFindComponent> & { controller: Visualization };

const createProps = (): ReadyMeshFindProps => {
  const controller = new Visualization();
  controller.fromModel({
    graph: { id: 'mesh', type: 'graph', data: { meshData: { elementsChanged: false } } },
    nodes: [
      { id: 'source', type: 'node', width: 40, height: 40, data: { infraName: 'source', isInaccessible: true } },
      { id: 'target', type: 'node', width: 40, height: 40, data: { infraName: 'target', isInaccessible: false } }
    ],
    edges: [{ id: 'edge', type: 'edge', source: 'source', target: 'target', data: {} }]
  });
  return {
    controller,
    findValue: '',
    hideValue: 'name contains source',
    layout: MeshLayout.Dagre,
    setFindValue: rstest.fn(),
    setHideValue: rstest.fn(),
    updateTime: 1
  };
};

describe('Mesh find/hide after refresh', () => {
  beforeEach(() => {
    rstest.mocked(layoutMesh).mockClear();
  });

  it.each(['name contains source', 'name contains prom', 'inaccessible'])(
    'preserves the viewport when refreshing with Hide %s',
    hideValue => {
      const props = { ...createProps(), hideValue };
      const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });

      rerender(<MeshFindComponent {...props} updateTime={2} />);

      expect(layoutMesh).toHaveBeenCalledWith(props.controller, MeshLayoutType.LayoutNoFit, false);
    }
  );

  it('reapplies Hide to refreshed node data without resetting the viewport', () => {
    const props = { ...createProps(), hideValue: 'inaccessible' };
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });
    const source = props.controller.getElementById('source')!;
    rerender(<MeshFindComponent {...props} updateTime={2} />);
    expect(source.isVisible()).toBe(false);

    setObserved(() => source.setData({ ...source.getData(), isInaccessible: false }));
    rerender(<MeshFindComponent {...props} updateTime={3} />);

    expect(source.isVisible()).toBe(true);
    expect(props.controller.getElementById('edge')!.isVisible()).toBe(true);
    expect(layoutMesh).toHaveBeenLastCalledWith(props.controller, MeshLayoutType.LayoutNoFit, false);
  });

  it('still reapplies Find after refreshed node data is available', () => {
    const props = { ...createProps(), findValue: 'inaccessible', hideValue: '' };
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });
    const source = props.controller.getElementById('source')!;
    rerender(<MeshFindComponent {...props} updateTime={2} />);
    expect(source.getData().isFind).toBe(true);

    setObserved(() => source.setData({ ...source.getData(), isInaccessible: false }));
    rerender(<MeshFindComponent {...props} updateTime={3} />);

    expect(source.getData().isFind).toBe(false);
    expect(layoutMesh).not.toHaveBeenCalled();
  });

  it('still fits when the user changes Hide', () => {
    const props = createProps();
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<MeshFindComponent {...props} hideValue="name contains target" />);

    expect(layoutMesh).toHaveBeenLastCalledWith(props.controller, MeshLayoutType.Layout, true);
  });

  it('restores hidden elements and fits when clearing Hide', () => {
    const props = createProps();
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });
    rerender(<MeshFindComponent {...props} updateTime={2} />);
    expect(props.controller.getElementById('source')!.isVisible()).toBe(false);

    rerender(<MeshFindComponent {...props} hideValue="" updateTime={3} />);

    expect(props.controller.getElementById('source')!.isVisible()).toBe(true);
    expect(props.controller.getElementById('edge')!.isVisible()).toBe(true);
    expect(layoutMesh).toHaveBeenLastCalledWith(props.controller, MeshLayoutType.Layout, true);
  });

  it('does not relayout an unfiltered mesh on refresh', () => {
    const props = { ...createProps(), hideValue: '' };
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<MeshFindComponent {...props} updateTime={2} />);

    expect(layoutMesh).not.toHaveBeenCalled();
  });

  it('still resets and fits when the applied model has a topology change', () => {
    const props = createProps();
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });
    setObserved(() => props.controller.getGraph().setData({ meshData: { elementsChanged: true } }));

    rerender(<MeshFindComponent {...props} updateTime={2} />);

    expect(layoutMesh).toHaveBeenLastCalledWith(props.controller, MeshLayoutType.Layout, true);
  });

  it('hides newly added matching nodes before requesting the final fit', () => {
    const props = createProps();
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });
    const model = props.controller.toModel();
    model.graph!.data = { meshData: { elementsChanged: true } };
    model.nodes!.push({ id: 'added', type: 'node', width: 40, height: 40, data: { infraName: 'source-added' } });
    props.controller.fromModel(model);

    rerender(<MeshFindComponent {...props} updateTime={2} />);

    expect(props.controller.getElementById('added')!.isVisible()).toBe(false);
    expect(layoutMesh).toHaveBeenLastCalledWith(props.controller, MeshLayoutType.Layout, true);
  });

  it('does not treat a stale topology flag as a new model update on Find edits', () => {
    const props = createProps();
    setObserved(() => props.controller.getGraph().setData({ meshData: { elementsChanged: true } }));
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });

    rerender(<MeshFindComponent {...props} findValue="name contains target" />);

    expect(layoutMesh).not.toHaveBeenCalled();
  });

  it('still resets and fits when a controller first becomes available', () => {
    const props = createProps();
    const { rerender } = render(<MeshFindComponent {...props} controller={undefined} />, { wrapper: Wrapper });

    rerender(<MeshFindComponent {...props} />);

    expect(layoutMesh).toHaveBeenLastCalledWith(props.controller, MeshLayoutType.Layout, true);
  });

  it('still resets and fits when replacing the controller', () => {
    const props = createProps();
    const { rerender } = render(<MeshFindComponent {...props} />, { wrapper: Wrapper });
    const replacement = createProps().controller;

    rerender(<MeshFindComponent {...props} controller={replacement} />);

    expect(layoutMesh).toHaveBeenLastCalledWith(replacement, MeshLayoutType.Layout, true);
  });
});
