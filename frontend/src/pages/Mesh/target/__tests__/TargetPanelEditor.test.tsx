import { render, screen } from '@testing-library/react';
import { TargetPanelEditor } from '../TargetPanelEditor';

const mockOnDidContentSizeChange = rstest.fn();
const mockGetContentHeight = rstest.fn(() => 480);

rstest.mock('@monaco-editor/react', () => ({
  default: ({
    height,
    onMount
  }: {
    height: string;
    onMount: (ed: { getContentHeight: () => number; onDidContentSizeChange: (cb: () => void) => void }) => void;
  }) => {
    onMount({
      getContentHeight: mockGetContentHeight,
      onDidContentSizeChange: mockOnDidContentSizeChange
    });

    return <div data-test="monaco-editor-mock" data-height={height} />;
  }
}));

rstest.mock('utils/ThemeUtils', () => ({
  useKialiTheme: () => 'Light'
}));

rstest.mock('components/Mesh/ConfigButtonsTargetPanel', () => ({
  ConfigButtonsTargetPanel: () => <div data-test="config-buttons" />
}));

describe('TargetPanelEditor', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
  });

  it('sizes the editor to Monaco content height and listens for content size changes', () => {
    render(<TargetPanelEditor configData={{ mesh: { trustDomain: 'cluster.local' } }} targetName="istiod" />);

    expect(screen.getByTestId('target-panel-editor')).toBeInTheDocument();
    expect(mockGetContentHeight).toHaveBeenCalled();
    expect(mockOnDidContentSizeChange).toHaveBeenCalled();
    expect(screen.getByTestId('monaco-editor-mock')).toHaveAttribute('data-height', '480px');
  });
});
