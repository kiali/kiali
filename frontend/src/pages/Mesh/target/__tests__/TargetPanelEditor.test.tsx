import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { TargetPanelEditor } from '../TargetPanelEditor';

const mockOnDidContentSizeChange = rstest.fn();
const mockGetContentHeight = rstest.fn(() => 480);
let contentSizeChangeCallback: (() => void) | undefined;

rstest.mock('@monaco-editor/react', () => {
  const MonacoEditorMock = ({
    height,
    onMount,
    options
  }: {
    height: string;
    onMount: (ed: { getContentHeight: () => number; onDidContentSizeChange: (cb: () => void) => void }) => void;
    options?: Record<string, unknown>;
  }) => {
    React.useEffect(() => {
      onMount({
        getContentHeight: mockGetContentHeight,
        onDidContentSizeChange: (cb: () => void) => {
          contentSizeChangeCallback = cb;
          mockOnDidContentSizeChange(cb);
        }
      });
    }, []);

    return (
      <div
        data-test="monaco-editor-mock"
        data-height={height}
        data-automatic-layout={String(options?.automaticLayout)}
      />
    );
  };

  return { default: MonacoEditorMock };
});

rstest.mock('utils/ThemeUtils', () => ({
  useKialiTheme: () => 'Light'
}));

rstest.mock('components/Mesh/ConfigButtonsTargetPanel', () => ({
  ConfigButtonsTargetPanel: () => <div data-test="config-buttons" />
}));

describe('TargetPanelEditor', () => {
  beforeEach(() => {
    rstest.clearAllMocks();
    contentSizeChangeCallback = undefined;
    mockGetContentHeight.mockReturnValue(480);
  });

  it('sizes the editor to Monaco content height and listens for content size changes', async () => {
    render(<TargetPanelEditor configData={{ mesh: { trustDomain: 'cluster.local' } }} targetName="istiod" />);

    expect(screen.getByTestId('target-panel-editor')).toBeInTheDocument();

    await waitFor(() => {
      expect(mockGetContentHeight).toHaveBeenCalled();
      expect(mockOnDidContentSizeChange).toHaveBeenCalled();
      expect(screen.getByTestId('monaco-editor-mock')).toHaveAttribute('data-height', '480px');
    });
  });

  it('updates editor height when Monaco reports a content size change', async () => {
    render(<TargetPanelEditor configData={{ mesh: { trustDomain: 'cluster.local' } }} targetName="istiod" />);

    await waitFor(() => {
      expect(contentSizeChangeCallback).toBeDefined();
      expect(screen.getByTestId('monaco-editor-mock')).toHaveAttribute('data-height', '480px');
    });

    mockGetContentHeight.mockReturnValue(560);

    act(() => {
      contentSizeChangeCallback?.();
    });

    expect(screen.getByTestId('monaco-editor-mock')).toHaveAttribute('data-height', '560px');
  });

  it('enables automaticLayout so wrapped content reflows on container resize', async () => {
    render(<TargetPanelEditor configData={{ mesh: { trustDomain: 'cluster.local' } }} targetName="istiod" />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-mock')).toHaveAttribute('data-automatic-layout', 'true');
    });
  });
});
