import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NamespaceActions, NamespaceAction } from '../NamespaceActions';

describe('NamespaceActions', () => {
  const mockNamespace = 'test-namespace';

  describe('Component rendering', () => {
    it('renders without crashing', () => {
      const { container } = render(<NamespaceActions namespace={mockNamespace} actions={[]} />);
      expect(container).toBeTruthy();
    });

    it('renders a dropdown menu', () => {
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: jest.fn()
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
    });

    it('renders menu toggle button', () => {
      render(<NamespaceActions namespace={mockNamespace} actions={[]} />);
      expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
    });
  });

  describe('Simple actions', () => {
    it('renders simple action items', async () => {
      const user = userEvent.setup();
      const actionFn = jest.fn();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: actionFn
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(screen.getByRole('menuitem', { name: 'Test Action' })).toBeInTheDocument();
    });

    it('calls action when simple item is clicked', async () => {
      const user = userEvent.setup();
      const actionFn = jest.fn();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: actionFn
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));
      await user.click(screen.getByRole('menuitem', { name: 'Test Action' }));

      expect(actionFn).toHaveBeenCalledWith(mockNamespace);
    });

    it('renders disabled action item', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Disabled Action',
          action: jest.fn(),
          isDisabled: true
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      const mi = screen.getByRole('menuitem', { name: 'Disabled Action' });
      expect(mi).toBeInTheDocument();
    });

    it('renders external link icon for external actions', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'External Action',
          action: jest.fn(),
          isExternal: true
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));
      const menu = screen.getByRole('menu');
      expect(menu.textContent).toContain('External Action');
      expect(menu.querySelector('svg')).toBeTruthy();
    });
  });

  describe('Grouped actions', () => {
    it('renders action groups', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: jest.fn()
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Applications',
              action: jest.fn()
            }
          ]
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(screen.getByText('Show')).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Graph' })).toBeInTheDocument();
    });

    it('renders children in action groups', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: jest.fn()
            },
            {
              isGroup: true,
              isSeparator: false,
              title: 'Applications',
              action: jest.fn()
            }
          ]
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(screen.getByRole('menuitem', { name: 'Graph' })).toBeInTheDocument();
      expect(screen.getByRole('menuitem', { name: 'Applications' })).toBeInTheDocument();
    });

    it('calls action when grouped item is clicked', async () => {
      const user = userEvent.setup();
      const actionFn = jest.fn();
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Graph',
              action: actionFn
            }
          ]
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));
      await user.click(screen.getByRole('menuitem', { name: 'Graph' }));

      expect(actionFn).toHaveBeenCalledWith(mockNamespace);
    });

    it('renders disabled items in groups with tooltip', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Show',
          children: [
            {
              isGroup: true,
              isSeparator: false,
              title: 'Disabled Action',
              action: jest.fn(),
              isDisabled: true
            }
          ]
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      const mi = screen.getByRole('menuitem', { name: 'Disabled Action' });
      expect(mi).toBeInTheDocument();

      await user.hover(mi.closest('div')!);
      expect(await screen.findByText('No user permission or Kiali in view-only mode')).toBeInTheDocument();
    });
  });

  describe('Separators', () => {
    it('renders separator dividers', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Action 1',
          action: jest.fn()
        },
        {
          isGroup: false,
          isSeparator: true
        },
        {
          isGroup: false,
          isSeparator: false,
          title: 'Action 2',
          action: jest.fn()
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(screen.getByRole('separator')).toBeInTheDocument();
    });
  });

  describe('Dropdown toggle behavior', () => {
    it('opens dropdown when toggle is clicked', async () => {
      const user = userEvent.setup();
      render(<NamespaceActions namespace={mockNamespace} actions={[]} />);
      const toggle = screen.getByRole('button', { name: 'Actions' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');

      await user.click(toggle);

      expect(toggle).toHaveAttribute('aria-expanded', 'true');
    });

    it('handles item selection', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false,
          title: 'Test Action',
          action: jest.fn()
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);

      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute('aria-expanded', 'true');

      await user.click(screen.getByRole('menuitem', { name: 'Test Action' }));

      expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('handles empty actions array', () => {
      render(<NamespaceActions namespace={mockNamespace} actions={[]} />);
      expect(screen.getByRole('button', { name: 'Actions' })).toBeInTheDocument();
    });

    it('handles action without title or action function', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: false,
          isSeparator: false
        }
      ];

      render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    });

    it('handles group without children', async () => {
      const user = userEvent.setup();
      const actions: NamespaceAction[] = [
        {
          isGroup: true,
          isSeparator: false,
          title: 'Empty Group'
        }
      ];

      const { container } = render(<NamespaceActions namespace={mockNamespace} actions={actions} />);
      await user.click(screen.getByRole('button', { name: 'Actions' }));

      expect(container).toBeTruthy();
    });
  });
});
