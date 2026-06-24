import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from 'store/ConfigStore';
import { ChatAIActions } from 'actions/ChatAIActions';
import { ToolModal } from '../ToolModal';

// ToolModal uses <Trans> from react-i18next for templated strings.
// The Trans component receives i18next interpolation objects like {{ name }} as
// direct React children, which are plain JS objects and not valid React children.
// The mock factory must use require() instead of the imported React reference
// because jest.mock() is hoisted before import statements.
jest.mock('react-i18next', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ReactModule = require('react');

  // Render a single node safely, converting i18next object interpolations to strings.
  const renderSafe = (node: any): any => {
    if (typeof node === 'string' || typeof node === 'number') return node;
    if (node === null || node === undefined) return null;
    // React element: $$typeof is set for valid React elements
    if (node && typeof node === 'object' && node.$$typeof) {
      const childContent = node.props?.children;
      // i18next interpolation object inside a wrapper element, e.g. <span>{{ name }}</span>
      if (childContent !== null && typeof childContent === 'object' && !(childContent && childContent.$$typeof)) {
        return ReactModule.cloneElement(node, {}, Object.values(childContent).map(String).join(''));
      }
      return node;
    }
    // Bare interpolation object at root level inside Trans
    if (typeof node === 'object') {
      return Object.values(node).map(String).join('');
    }
    return null;
  };

  const Trans = ({ children }: { children?: any }): any => {
    const safeNodes = Array.isArray(children) ? children.map(renderSafe) : [renderSafe(children)];
    return ReactModule.createElement(ReactModule.Fragment, null, ...safeNodes);
  };

  return {
    useTranslation: () => ({
      t: (key: string) => key,
      i18n: { language: 'en', changeLanguage: () => {} }
    }),
    Trans
  };
});

const ENTRY_ID = 'modal-test-entry';

const renderToolModal = (): ReturnType<typeof render> =>
  render(
    <Provider store={store}>
      <ToolModal />
    </Provider>
  );

const setupEntry = (): void => {
  store.dispatch(ChatAIActions.setChatHistoryClear());
  store.dispatch(
    ChatAIActions.setChatHistoryAdd({
      entry: { id: ENTRY_ID, who: 'ai', text: '', isStreaming: false, isCancelled: false, isTruncated: false }
    })
  );
};

const openTool = (toolID: string, tool: Record<string, unknown>): void => {
  store.dispatch(ChatAIActions.setChatHistoryUpdateTool({ id: ENTRY_ID, toolID, tool: tool as any }));
  store.dispatch(ChatAIActions.setOpenTool({ chatEntryIndex: 0, id: toolID }));
};

describe('ToolModal', () => {
  beforeEach(() => {
    setupEntry();
    store.dispatch(ChatAIActions.clearOpenTool());
  });

  // ── No open tool ──────────────────────────────────────────────────────────────

  it('renders nothing when no tool is open', () => {
    const { container } = renderToolModal();
    expect(container.firstChild).toBeNull();
  });

  // ── Basic rendering ───────────────────────────────────────────────────────────

  describe('basic rendering', () => {
    it('renders the modal when a tool is open', () => {
      openTool('tool-1', { name: 'get_pods', args: {}, content: 'pod output', status: 'success' });
      renderToolModal();
      expect(screen.getByTestId('ai-tool-modal')).toBeInTheDocument();
    });

    it('shows the "Tool output" header', () => {
      openTool('tool-1', { name: 'get_pods', args: {}, content: 'pod output', status: 'success' });
      renderToolModal();
      expect(screen.getByText('Tool output')).toBeInTheDocument();
    });

    it('shows the tool content in a code block', () => {
      openTool('tool-1', { name: 'list_ns', args: {}, content: 'ns-output-text', status: 'success' });
      renderToolModal();
      expect(screen.getByText('Content')).toBeInTheDocument();
      expect(screen.getByText('ns-output-text')).toBeInTheDocument();
    });
  });

  // ── Status label ──────────────────────────────────────────────────────────────

  describe('status label', () => {
    it('shows "Status" row with a "success" label for a successful tool', () => {
      openTool('tool-ok', { name: 'get_pods', args: {}, content: 'pods', status: 'success' });
      renderToolModal();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('success')).toBeInTheDocument();
    });

    it('shows a "truncated" label for a truncated tool', () => {
      openTool('tool-trunc', { name: 'big_list', args: {}, content: 'partial…', status: 'truncated' });
      renderToolModal();
      expect(screen.getByText('truncated')).toBeInTheDocument();
    });
  });

  // ── Error state ───────────────────────────────────────────────────────────────

  describe('error state', () => {
    it('shows a danger alert for a tool with error status', () => {
      openTool('tool-err', { name: 'broken_tool', args: {}, content: '', status: 'error' });
      renderToolModal();
      expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
    });
  });

  // ── Denied tool ───────────────────────────────────────────────────────────────

  describe('denied tool', () => {
    it('shows "Tool call rejected" in the header', () => {
      openTool('tool-denied', { name: 'delete_namespace', args: { ns: 'production' }, content: '', isDenied: true });
      renderToolModal();
      expect(screen.getByText('Tool call rejected')).toBeInTheDocument();
    });

    it('does not show the Status row for a denied tool', () => {
      openTool('tool-denied', { name: 'drop_db', args: {}, content: '', isDenied: true });
      renderToolModal();
      expect(screen.queryByText('Status')).not.toBeInTheDocument();
    });

    it('does not show the Content section for a denied tool', () => {
      openTool('tool-denied', { name: 'drop_db', args: {}, content: 'some content', isDenied: true });
      renderToolModal();
      expect(screen.queryByText('Content')).not.toBeInTheDocument();
    });
  });

  // ── MCP server name ───────────────────────────────────────────────────────────

  describe('MCP server name', () => {
    it('shows the MCP server name when provided', () => {
      openTool('tool-mcp', {
        name: 'get_pods',
        args: {},
        content: '',
        status: 'success',
        serverName: 'kube-mcp-server'
      });
      renderToolModal();
      expect(screen.getByText('MCP server')).toBeInTheDocument();
      expect(screen.getByText('kube-mcp-server')).toBeInTheDocument();
    });

    it('does not show the MCP server row when serverName is absent', () => {
      openTool('tool-no-mcp', { name: 'local_tool', args: {}, content: '', status: 'success' });
      renderToolModal();
      expect(screen.queryByText('MCP server')).not.toBeInTheDocument();
    });
  });

  // ── UI resource ───────────────────────────────────────────────────────────────

  describe('UI resource URI', () => {
    it('shows the UI resource URI when present', () => {
      openTool('tool-ui', {
        name: 'kiali_resource',
        args: {},
        content: '',
        status: 'success',
        uiResourceUri: '/kiali/namespaces/default/services/productpage'
      });
      renderToolModal();
      expect(screen.getByText('UI resource')).toBeInTheDocument();
      expect(screen.getByText('/kiali/namespaces/default/services/productpage')).toBeInTheDocument();
    });
  });

  // ── Structured content ────────────────────────────────────────────────────────

  describe('structured content', () => {
    it('shows a formatted JSON block when structured content is provided', () => {
      openTool('tool-structured', {
        name: 'get_service',
        args: {},
        content: '',
        status: 'success',
        structuredContent: { name: 'productpage', namespace: 'bookinfo' }
      });
      renderToolModal();
      expect(screen.getByText('Structured content')).toBeInTheDocument();
      // JSON.stringify output appears in the code block
      expect(screen.getByText(/"name": "productpage"/)).toBeInTheDocument();
    });
  });

  // ── Close button ──────────────────────────────────────────────────────────────

  describe('close button', () => {
    it('dispatches clearOpenTool when the modal is closed', () => {
      openTool('tool-close', { name: 'get_pods', args: {}, content: '', status: 'success' });
      renderToolModal();

      // PF Modal's close button has aria-label "Close"
      const closeButton = screen.getByRole('button', { name: /close/i });
      fireEvent.click(closeButton);

      const state = store.getState();
      expect(state.aiChat.openTool.get('id')).toBeNull();
      expect(state.aiChat.openTool.get('chatEntryIndex')).toBeNull();
    });
  });
});
