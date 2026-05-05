import * as React from 'react';
import { render, screen } from '@testing-library/react';

import { NotificationCenterBadgeComponent } from '../NotificationCenterBadge';
import { NotificationGroup, NotificationMessage, MessageType } from '../../../types/NotificationCenter';

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
});
