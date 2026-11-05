import { render, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom-v5-compat';
import { createStore } from 'redux';

import { INITIAL_TROUBLESHOOTING_STATE } from 'reducers/ChatAIState';
import { INITIAL_NOTIFICATION_CENTER_STATE } from 'reducers/NotificationCenter';
import { NotificationCenter } from '../NotificationCenter';
import { NotificationCenterBadge, NotificationCenterBadgeComponent } from '../NotificationCenterBadge';
import { MessageType, type NotificationGroup, type NotificationMessage } from '../../../types/NotificationCenter';

describe('NotificationCenter', () => {
  const groupMessages: NotificationGroup[] = [
    {
      id: 'first',
      title: 'im first',
      messages: [
        {
          id: 1,
          seen: false,
          content: 'show me',
          type: MessageType.DANGER,
          count: 0,
          isAlert: true,
          created: new Date(),
          detail: '',
          showDetail: false
        },
        {
          id: 2,
          seen: false,
          content: 'hide me',
          type: MessageType.DANGER,
          count: 0,
          created: new Date(),
          detail: '',
          showDetail: false,
          isAlert: true
        }
      ],
      variant: 'danger'
    },
    {
      id: 'second',
      title: 'im second',
      messages: [
        {
          id: 3,
          seen: true,
          content: 'show me too',
          type: MessageType.SUCCESS,
          count: 0,
          isAlert: false,
          created: new Date(),
          detail: '',
          showDetail: false
        }
      ],
      variant: 'danger'
    }
  ];

  const getAlertsFromGroups = (groups: NotificationGroup[]): NotificationMessage[] => {
    return groups
      .reduce((unreadMessages: NotificationMessage[], group: NotificationGroup) => {
        return unreadMessages.concat(group.messages.filter(message => !message.seen));
      }, [])
      .filter(message => message.isAlert);
  };

  it('.getNotificationMessages only gets notifications', () => {
    const alerts = getAlertsFromGroups(groupMessages);
    render(
      <NotificationCenterBadgeComponent
        alerts={alerts}
        needsAttention={true}
        newMessageCount={3}
        onDismissNotification={() => {}}
        toggleNotificationCenter={() => {}}
      />
    );
    expect(screen.getByText('show me')).toBeInTheDocument();
    expect(screen.getByText('hide me')).toBeInTheDocument();
    expect(screen.queryByText('show me too')).not.toBeInTheDocument();
    // Each PF6 Alert renders a heading (h4) with the alert title
    expect(screen.getAllByRole('heading')).toHaveLength(2);
  });

  it('adds troubleshooting problems to the notification count', () => {
    render(
      <NotificationCenterBadgeComponent
        alerts={[]}
        needsAttention={false}
        newMessageCount={2}
        onDismissNotification={() => {}}
        toggleNotificationCenter={() => {}}
        troubleshootingCount={3}
        troubleshootingNeedsAttention={true}
      />
    );

    const badges = screen.getAllByTestId('notifications-badge');
    expect(badges[0]).toHaveTextContent('2');
    expect(badges[0]).toHaveTextContent('3');
  });

  it('shows the troubleshooting summary and links to the troubleshooting page', () => {
    const store = createStore(() => ({
      ai: {
        enabled: true,
        troubleshooting: {
          ...INITIAL_TROUBLESHOOTING_STATE,
          issues: [
            {
              category: 'data_plane',
              id: 'dp-1',
              problem: 'Reviews is unhealthy',
              subProblems: [{ id: 'sub-1', impact: 'Down', issue: 'Crash', severity: 'critical', target: 'reviews' }]
            }
          ],
          loaded: true
        }
      },
      globalState: { kiosk: '' },
      notificationCenter: INITIAL_NOTIFICATION_CENTER_STATE
    }));

    render(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationCenter />
        </MemoryRouter>
      </Provider>
    );

    const section = screen.getByTestId('troubleshooting-notification-section');
    expect(within(section).getByText('Troubleshooting')).toBeInTheDocument();
    expect(screen.getByTestId('troubleshooting-notification-link')).toHaveTextContent('(1 problem detected)');
    expect(screen.getByTestId('troubleshooting-notification-link')).toHaveAttribute('href', '/ai?tab=troubleshooting');
  });

  it('omits hidden troubleshooting problems from the drawer and the badge', () => {
    const store = createStore(() => ({
      ai: {
        chat: { visible: false },
        enabled: true,
        troubleshooting: {
          ...INITIAL_TROUBLESHOOTING_STATE,
          hiddenSubProblemIds: ['dp-hidden', 'sub-hidden'],
          issues: [
            {
              category: 'data_plane',
              id: 'dp-hidden',
              problem: 'Hidden parent',
              subProblems: [
                { id: 'sub-parent', impact: 'Down', issue: 'Parent crash', severity: 'critical', target: 'a' }
              ]
            },
            {
              category: 'data_plane',
              id: 'dp-visible',
              problem: 'Visible parent',
              subProblems: [
                { id: 'sub-hidden', impact: 'Down', issue: 'Hidden crash', severity: 'critical', target: 'b' },
                { id: 'sub-visible', impact: 'Slow', issue: 'Visible crash', severity: 'warning', target: 'c' }
              ]
            }
          ],
          loaded: true
        }
      },
      globalState: { kiosk: '' },
      notificationCenter: INITIAL_NOTIFICATION_CENTER_STATE
    }));

    render(
      <Provider store={store}>
        <MemoryRouter>
          <NotificationCenterBadge />
          <NotificationCenter />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByTestId('troubleshooting-notification-link')).toHaveTextContent('(1 problem detected)');
  });
});
