import {
  getTopologyResizeTarget,
  TOPOLOGY_GRAPH_CONTAINER_ID,
  TOPOLOGY_MESH_CONTAINER_ID
} from '../ResizeDetectorUtils';

describe('getTopologyResizeTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('returns the graph container when present', () => {
    const el = document.createElement('div');
    el.id = TOPOLOGY_GRAPH_CONTAINER_ID;
    document.body.appendChild(el);

    expect(getTopologyResizeTarget()).toBe(el);
  });

  it('falls back to mesh container when graph container is absent', () => {
    const el = document.createElement('div');
    el.id = TOPOLOGY_MESH_CONTAINER_ID;
    document.body.appendChild(el);

    expect(getTopologyResizeTarget()).toBe(el);
  });

  it('falls back to document.body when neither container exists', () => {
    expect(getTopologyResizeTarget()).toBe(document.body);
  });
});
