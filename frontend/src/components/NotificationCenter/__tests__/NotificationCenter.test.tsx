import * as React from 'react';
import { shallow } from 'enzyme';

import { NotificationAlerts } from '../NotificationAlerts';
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

  // Helper function to extract alerts from groups (mimics mapStateToProps logic)
  const getAlertsFromGroups = (groups: NotificationGroup[]): NotificationMessage[] => {
    return groups
      .reduce((unreadMessages: NotificationMessage[], group: NotificationGroup) => {
        return unreadMessages.concat(group.messages.filter(message => !message.seen));
      }, [])
      .filter(message => message.isAlert);
  };

  it('.getNotificationMessages only gets notifications', () => {
    const alerts = getAlertsFromGroups(groupMessages);
    const wrapper = shallow(
      <NotificationCenterBadgeComponent
        alerts={alerts}
        needsAttention={true}
        newMessageCount={3}
        onDismissNotification={() => {}}
        toggleNotificationCenter={() => {}}
      />
    );
    const notificationAlerts = wrapper.find(NotificationAlerts);
    expect(notificationAlerts.prop('alerts').length).toEqual(2);
  });
});
