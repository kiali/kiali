import { ModelKind } from '@patternfly/react-topology';
import { meshComponentFactory } from '../MeshComponentFactory';

describe('meshComponentFactory', () => {
  it('returns a component for ModelKind.graph', () => {
    const result = meshComponentFactory(ModelKind.graph, '');
    expect(result).toBeDefined();
  });

  it('returns a component for ModelKind.edge', () => {
    const result = meshComponentFactory(ModelKind.edge, '');
    expect(result).toBeDefined();
  });

  it('returns undefined for unknown model kinds', () => {
    const result = meshComponentFactory('unknownKind' as ModelKind, '');
    expect(result).toBeUndefined();
  });
});
