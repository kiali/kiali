// Assisted-by: Codex
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { Node } from '@patternfly/react-topology';
import {
  DEFAULT_LAYER,
  ElementContext,
  LayersProvider,
  NodeShape,
  Point,
  SVGDefsProvider,
  TOP_LAYER,
  Visualization,
  VisualizationProvider
} from '@patternfly/react-topology';
import { MeshNode } from '../MeshNode';
import { MeshInfraType } from 'types/Mesh';

type RenderedNode = ReturnType<typeof render> & {
  node: Node;
  onHover: ReturnType<typeof rstest.fn>;
  onSelect: ReturnType<typeof rstest.fn>;
  setDragging: (dragging: boolean) => void;
};

const renderNode = (scale = 0.6): RenderedNode => {
  const onHover = rstest.fn();
  const onSelect = rstest.fn();
  const controller = new Visualization();
  controller.fromModel({
    graph: { id: 'graph', type: 'graph', scale },
    nodes: [
      { id: 'namespace', type: 'group', group: true, children: ['node'], x: 200, y: 100 },
      {
        id: 'node',
        type: 'node',
        x: 40,
        y: 60,
        width: 60,
        height: 60,
        shape: NodeShape.ellipse,
        label: 'productpage',
        data: {
          onHover,
          infraType: MeshInfraType.DATAPLANE,
          isUnhighlighted: true,
          isFind: true,
          attachments: <g data-test="attachment" />
        }
      }
    ]
  });
  const node = controller.getNodeById('node') as Node;
  const view = (dragging: boolean): JSX.Element => (
    <VisualizationProvider controller={controller}>
      <svg>
        <SVGDefsProvider>
          <LayersProvider layers={[DEFAULT_LAYER, TOP_LAYER]}>
            <ElementContext.Provider value={node}>
              <MeshNode element={node} onSelect={onSelect} dragging={dragging} />
            </ElementContext.Provider>
          </LayersProvider>
        </SVGDefsProvider>
      </svg>
    </VisualizationProvider>
  );
  const result = render(view(false));
  return { ...result, node, onHover, onSelect, setDragging: (dragging: boolean) => result.rerender(view(dragging)) };
};

describe('mesh node hover layering', () => {
  const originalGetBBox = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getBBox');

  beforeAll(() => {
    // jsdom does not measure SVG text; keep the real PatternFly label and portal rendering.
    Object.defineProperty(SVGElement.prototype, 'getBBox', {
      configurable: true,
      value: () => ({ x: 0, y: 0, width: 120, height: 16 })
    });
  });

  afterAll(() => {
    if (originalGetBBox) {
      Object.defineProperty(SVGElement.prototype, 'getBBox', originalGetBBox);
    } else {
      Reflect.deleteProperty(SVGElement.prototype, 'getBBox');
    }
  });

  beforeEach(() => {
    rstest.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    rstest.useRealTimers();
  });

  it.each([
    { scale: 0.6, entry: 'node' },
    { scale: 0.6, entry: 'label' },
    { scale: 0.4, entry: 'node' },
    { scale: 0.2, entry: 'node' }
  ])('raises the node and label together at scale $scale entering the $entry', ({ scale, entry }) => {
    const { container, node, onHover, onSelect } = renderNode(scale);
    const defaultLayer = container.querySelector('[data-layer-id="default"]')!;
    const topLayer = container.querySelector('[data-layer-id="top"]')!;
    const body = defaultLayer.querySelector('.pf-topology__node__background')!;
    const target = entry === 'node' ? body : defaultLayer.querySelector('.pf-topology__node__label')!;

    fireEvent.mouseEnter(body.closest('g[style]')!);
    fireEvent.mouseOver(target, { relatedTarget: null });
    act(() => {
      rstest.advanceTimersByTime(200);
    });

    const raisedLabel = topLayer.querySelector('.pf-topology__node__label')!;
    expect(raisedLabel).not.toBeNull();
    const raisedBody = topLayer.querySelector('.pf-topology__node__background')!;
    expect(raisedBody).not.toBeNull();
    expect(topLayer.querySelector('[data-id="node"]')).toHaveAttribute('transform', 'translate(40, 60)');
    expect(topLayer.querySelector('[data-test="attachment"]')).not.toBeNull();
    expect(topLayer.querySelector('svg')).not.toBeNull();
    expect(raisedBody.closest('g[style]')).toHaveStyle({ opacity: '0.1' });
    expect(defaultLayer.querySelector('.pf-topology__node__background')).toBeNull();
    expect(raisedBody.closest('.pf-topology__node')).toBe(raisedLabel.closest('.pf-topology__node'));

    // Browsers enter the remounted hover group after it moves layers; jsdom needs that event explicitly.
    fireEvent.mouseEnter(raisedBody.closest('g[style]')!);
    fireEvent.mouseOver(raisedBody, { relatedTarget: target });
    fireEvent.mouseOut(raisedBody, { relatedTarget: raisedLabel });
    fireEvent.mouseOver(raisedLabel, { relatedTarget: raisedBody });
    act(() => {
      rstest.advanceTimersByTime(1000);
    });

    expect(topLayer.querySelector('.pf-topology__node__label')).toBe(raisedLabel);
    expect(raisedLabel.closest('.pf-m-hover')).not.toBeNull();
    expect(onHover.mock.calls.every(([, isHovered]) => isHovered)).toBe(true);
    expect(onHover).toHaveBeenLastCalledWith(node, true);
    fireEvent.click(raisedLabel);
    expect(onSelect).toHaveBeenCalledTimes(1);

    fireEvent.mouseOut(raisedLabel, { relatedTarget: raisedBody });
    fireEvent.mouseOver(raisedBody, { relatedTarget: raisedLabel });
    act(() => {
      rstest.advanceTimersByTime(400);
    });
    expect(topLayer.querySelector('.pf-topology__node__label')).toBe(raisedLabel);
    expect(onHover.mock.calls.every(([, isHovered]) => isHovered)).toBe(true);

    fireEvent.mouseLeave(raisedBody.closest('g[style]')!);
    fireEvent.mouseOut(raisedBody, { relatedTarget: null });
    act(() => {
      rstest.advanceTimersByTime(400);
    });
    expect(topLayer.querySelector('.pf-topology__node')).toBeNull();
    expect(defaultLayer.querySelector('.pf-topology__node__background')).not.toBeNull();
    expect(onHover).toHaveBeenLastCalledWith(node, false);
    expect(defaultLayer.querySelector('.pf-m-hover')).toBeNull();
  });
  it('keeps the same raised node during dragging and follows its position', () => {
    const { container, node, setDragging } = renderNode();
    const topLayer = container.querySelector('[data-layer-id="top"]')!;
    const defaultLayer = container.querySelector('[data-layer-id="default"]')!;
    const body = defaultLayer.querySelector('.pf-topology__node__background')!;
    fireEvent.mouseEnter(body.closest('g[style]')!);
    act(() => {
      rstest.advanceTimersByTime(200);
    });
    const raisedBody = topLayer.querySelector('.pf-topology__node__background')!;
    const hoverGroup = raisedBody.closest('g[style]')!;
    fireEvent.mouseEnter(hoverGroup);

    setDragging(true);
    fireEvent.mouseLeave(hoverGroup);
    act(() => {
      node.setPosition(new Point(80, 90));
      rstest.advanceTimersByTime(1000);
    });
    expect(topLayer.querySelector('.pf-topology__node__background')).toBe(raisedBody);
    expect(topLayer.querySelector('[data-id="node"]')).toHaveAttribute('transform', 'translate(80, 90)');

    setDragging(false);
    expect(topLayer.querySelector('.pf-topology__node')).toBeNull();
    expect(defaultLayer.querySelector('.pf-topology__node__background')).not.toBeNull();
  });
});
