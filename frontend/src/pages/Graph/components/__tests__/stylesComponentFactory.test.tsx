import { ModelKind } from '@patternfly/react-topology';
import { stylesComponentFactory } from '../stylesComponentFactory';

describe('stylesComponentFactory', () => {
  it('returns a component for ModelKind.graph', () => {
    const result = stylesComponentFactory(ModelKind.graph, '');
    expect(result).toBeDefined();
  });

  it('returns a component for ModelKind.edge', () => {
    const result = stylesComponentFactory(ModelKind.edge, '');
    expect(result).toBeDefined();
  });

  it('returns undefined for unknown model kinds', () => {
    const result = stylesComponentFactory('unknownKind' as ModelKind, '');
    expect(result).toBeUndefined();
  });
});
