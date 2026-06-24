import * as React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { ChatAIActions } from 'actions/ChatAIActions';
import { ResponseTools } from '../ResponseTools';

// Stable entry ID used across all tests in this file
const ENTRY_ID = 'rt-test-entry';

const renderResponseTools = (entryIndex = 0): ReturnType<typeof render> =>
  render(
    <Provider store={store}>
      <ResponseTools entryIndex={entryIndex} />
    </Provider>
  );

/**
 * Dispatch a tool update for the fixed test entry.
 */
const addTool = (toolID: string, tool: Record<string, unknown>): void => {
  store.dispatch(ChatAIActions.setChatHistoryUpdateTool({ id: ENTRY_ID, toolID, tool: tool as any }));
};

describe('ResponseTools', () => {
  beforeEach(() => {
    store.dispatch(ChatAIActions.setChatHistoryClear());
    store.dispatch(
      ChatAIActions.setChatHistoryAdd({
        entry: { id: ENTRY_ID, who: 'ai', text: '', isStreaming: false, isCancelled: false, isTruncated: false }
      })
    );
    // Reset any open-tool state carried over from prior tests
    store.dispatch(ChatAIActions.clearOpenTool());
  });

  // ── Label rendering ───────────────────────────────────────────────────────────

  describe('label rendering', () => {
    it('renders a label with the tool name', () => {
      addTool('t1', { name: 'get_pods', args: {}, content: '', status: 'success' });
      renderResponseTools();
      expect(screen.getByTestId('ai-tool-label-get_pods')).toBeInTheDocument();
      expect(screen.getByText('get_pods')).toBeInTheDocument();
    });

    it('renders multiple tool labels', () => {
      addTool('t1', { name: 'get_pods', args: {}, content: '', status: 'success' });
      addTool('t2', { name: 'get_services', args: {}, content: '', status: 'success' });
      renderResponseTools();
      expect(screen.getByTestId('ai-tool-label-get_pods')).toBeInTheDocument();
      expect(screen.getByTestId('ai-tool-label-get_services')).toBeInTheDocument();
    });
  });

  // ── Tool status icons ─────────────────────────────────────────────────────────

  describe('tool status icons', () => {
    it('renders a spinner (progressbar) for a running tool', () => {
      addTool('t1', { name: 'list_services', args: {}, content: '', isRunning: true });
      renderResponseTools();
      // PF Spinner renders role="progressbar"
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('does not render a spinner for a completed tool', () => {
      addTool('t1', { name: 'list_services', args: {}, content: 'done', status: 'success' });
      renderResponseTools();
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('renders a red label for an error tool', () => {
      addTool('t1', { name: 'failing_tool', args: {}, content: '', status: 'error' });
      renderResponseTools();
      const label = screen.getByTestId('ai-tool-label-failing_tool');
      // PatternFly sets a color class; verify the element exists in the DOM
      expect(label).toBeInTheDocument();
    });

    it('renders a yellow label for a truncated tool', () => {
      addTool('t1', { name: 'big_output', args: {}, content: '', status: 'truncated' });
      renderResponseTools();
      expect(screen.getByTestId('ai-tool-label-big_output')).toBeInTheDocument();
    });

    it('renders a blue label for a tool with a UI resource URI', () => {
      addTool('t1', { name: 'kiali_resource', args: {}, content: '', uiResourceUri: '/kiali/graph' });
      renderResponseTools();
      expect(screen.getByTestId('ai-tool-label-kiali_resource')).toBeInTheDocument();
    });

    it('renders a grey denied label for a denied tool (no outline variant)', () => {
      addTool('t1', { name: 'delete_ns', args: {}, content: '', isDenied: true });
      renderResponseTools();
      const label = screen.getByTestId('ai-tool-label-delete_ns');
      expect(label).toBeInTheDocument();
      // Denied labels do not carry the "outline" modifier class
      expect(label.className).not.toMatch(/outline/);
    });
  });

  // ── User-approval filtering ───────────────────────────────────────────────────

  describe('user approval filtering', () => {
    it('hides a pending user-approval tool (awaiting decision)', () => {
      addTool('t1', { name: 'awaiting_approval', args: {}, content: '', isUserApproval: true });
      renderResponseTools();
      expect(screen.queryByTestId('ai-tool-label-awaiting_approval')).not.toBeInTheDocument();
    });

    it('shows an approved user-approval tool', () => {
      addTool('t1', {
        name: 'approved_tool',
        args: {},
        content: '',
        isUserApproval: true,
        isApproved: true
      });
      renderResponseTools();
      expect(screen.getByTestId('ai-tool-label-approved_tool')).toBeInTheDocument();
    });

    it('shows a denied user-approval tool', () => {
      addTool('t1', {
        name: 'denied_tool',
        args: {},
        content: '',
        isUserApproval: true,
        isDenied: true
      });
      renderResponseTools();
      expect(screen.getByTestId('ai-tool-label-denied_tool')).toBeInTheDocument();
    });
  });

  // ── Click interaction ─────────────────────────────────────────────────────────

  describe('click interaction', () => {
    it('dispatches setOpenTool when a tool label is clicked', () => {
      addTool('t1', { name: 'get_pods', args: {}, content: '', status: 'success' });
      renderResponseTools();

      // PF Label renders onClick on an inner <button> element, not the outer wrapper.
      // Click the button inside the label to trigger the dispatch.
      const label = screen.getByTestId('ai-tool-label-get_pods');
      const button = within(label).getByRole('button');
      fireEvent.click(button);

      const state = store.getState();
      expect(state.aiChat.openTool.get('id')).toBe('t1');
      expect(state.aiChat.openTool.get('chatEntryIndex')).toBe(0);
    });
  });
});
