import { NotificationCenterReducer } from '../NotificationCenter';
import { MessageType } from '../../types/NotificationCenter';
import { GlobalActions } from '../../actions/GlobalActions';
import { NotificationCenterActions } from '../../actions/NotificationCenterActions';

describe('NotificationCenterReducer reducer', () => {
  const RealDate = Date;

  const mockDate = date => {
    global.Date = jest.fn(() => date) as any;
    return date;
  };

  afterEach(() => {
    global.Date = RealDate;
  });

  it('should return the initial state', () => {
    expect(NotificationCenterReducer(undefined, GlobalActions.unknown())).toEqual({
      expanded: false,
      groups: [
        {
          id: 'danger',
          title: 'Error',
          messages: [],
          variant: 'danger'
        },
        {
          id: 'warning',
          title: 'Warning',
          messages: [],
          variant: 'warning'
        },
        {
          id: 'success',
          title: 'Success',
          messages: [],
          variant: 'success'
        },
        {
          id: 'info',
          title: 'Info',
          messages: [],
          variant: 'info'
        }
      ],
      nextId: 0
    });
  });

  it('should handle ADD_MESSAGE', () => {
    const date = mockDate(new Date());
    expect(
      NotificationCenterReducer(
        {
          expanded: false,
          groups: [
            {
              id: 'danger',
              messages: [],
              title: 'danger',
              variant: 'danger'
            }
          ],
          nextId: 0
        },
        NotificationCenterActions.addMessage('my new message', 'my detail', 'danger', MessageType.WARNING, true)
      )
    ).toEqual({
      expanded: false,
      groups: [
        {
          id: 'danger',
          messages: [
            {
              id: 0,
              seen: false,
              isAlert: true,
              content: 'my new message',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.WARNING,
              count: 1,
              firstTriggered: undefined,
              created: date
            }
          ],
          title: 'danger',
          variant: 'danger'
        }
      ],
      nextId: 1
    });
  });

  it('should handle Duplicate Messages', () => {
    const date = mockDate(new Date());
    expect(
      NotificationCenterReducer(
        {
          expanded: false,
          groups: [
            {
              id: 'danger',
              messages: [
                {
                  id: 0,
                  seen: false,
                  isAlert: true,
                  content: 'my new message',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.WARNING,
                  count: 1,
                  firstTriggered: undefined,
                  created: date
                }
              ],
              title: 'danger',
              variant: 'danger'
            }
          ],
          nextId: 0
        },
        NotificationCenterActions.addMessage('my new message', 'my detail', 'danger', MessageType.WARNING, true)
      )
    ).toEqual({
      expanded: false,
      groups: [
        {
          id: 'danger',
          messages: [
            {
              id: 0,
              seen: false,
              isAlert: true,
              content: 'my new message',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.WARNING,
              count: 2,
              firstTriggered: date,
              created: date
            }
          ],
          title: 'danger',
          variant: 'danger'
        }
      ],
      nextId: 1
    });
  });

  it('should handle REMOVE_MESSAGE', () => {
    const date = mockDate(new Date());
    expect(
      NotificationCenterReducer(
        {
          expanded: false,
          groups: [
            {
              id: 'danger',
              messages: [
                {
                  id: 0,
                  seen: false,
                  isAlert: true,
                  content: 'my new message',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.WARNING,
                  count: 1,
                  created: date
                },
                {
                  id: 1,
                  seen: true,
                  isAlert: false,
                  content: 'other message',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.DANGER,
                  count: 1,
                  created: date
                },
                {
                  id: 2,
                  seen: true,
                  isAlert: false,
                  content: 'other',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.INFO,
                  count: 1,
                  created: date
                }
              ],
              title: 'danger',
              variant: 'danger'
            }
          ],
          nextId: 1
        },
        NotificationCenterActions.removeMessage([0, 2])
      )
    ).toEqual({
      expanded: false,
      groups: [
        {
          id: 'danger',
          messages: [
            {
              id: 1,
              seen: true,
              isAlert: false,
              content: 'other message',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.DANGER,
              count: 1,
              created: date
            }
          ],
          title: 'danger',
          variant: 'danger'
        }
      ],
      nextId: 1
    });
  });

  it('should handle MARK_MESSAGE_AS_READ', () => {
    const date = mockDate(new Date());
    expect(
      NotificationCenterReducer(
        {
          expanded: false,
          groups: [
            {
              id: 'danger',
              messages: [
                {
                  id: 0,
                  seen: false,
                  isAlert: true,
                  content: 'my new message',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.WARNING,
                  count: 1,
                  created: date
                },
                {
                  id: 1,
                  seen: true,
                  isAlert: false,
                  content: 'other message',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.DANGER,
                  count: 1,
                  created: date
                },
                {
                  id: 2,
                  seen: false,
                  isAlert: false,
                  content: 'other',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.INFO,
                  count: 1,
                  created: date
                }
              ],
              title: 'danger',
              variant: 'danger'
            }
          ],
          nextId: 1
        },
        NotificationCenterActions.markAsRead([0, 1])
      )
    ).toEqual({
      expanded: false,
      groups: [
        {
          id: 'danger',
          messages: [
            {
              id: 0,
              seen: true,
              isAlert: false,
              content: 'my new message',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.WARNING,
              count: 1,
              created: date
            },
            {
              id: 1,
              seen: true,
              isAlert: false,
              content: 'other message',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.DANGER,
              count: 1,
              created: date
            },
            {
              id: 2,
              seen: false,
              isAlert: false,
              content: 'other',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.INFO,
              count: 1,
              created: date
            }
          ],
          title: 'danger',
          variant: 'danger'
        }
      ],
      nextId: 1
    });
  });

  it('should handle HIDE_NOTIFICATION', () => {
    const date = mockDate(new Date());
    expect(
      NotificationCenterReducer(
        {
          expanded: false,
          groups: [
            {
              id: 'danger',
              messages: [
                {
                  id: 0,
                  seen: false,
                  isAlert: true,
                  content: 'my new message',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.WARNING,
                  count: 1,
                  created: date
                },
                {
                  id: 1,
                  seen: false,
                  isAlert: true,
                  content: 'other message',
                  detail: 'my detail',
                  showDetail: false,
                  type: MessageType.DANGER,
                  count: 1,
                  created: date
                }
              ],
              title: 'danger',
              variant: 'danger'
            }
          ],
          nextId: 1
        },
        NotificationCenterActions.hideNotification(0)
      )
    ).toEqual({
      expanded: false,
      groups: [
        {
          id: 'danger',
          messages: [
            {
              id: 0,
              seen: false,
              isAlert: false,
              content: 'my new message',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.WARNING,
              count: 1,
              created: date
            },
            {
              id: 1,
              seen: false,
              isAlert: true,
              content: 'other message',
              detail: 'my detail',
              showDetail: false,
              type: MessageType.DANGER,
              count: 1,
              created: date
            }
          ],
          title: 'danger',
          variant: 'danger'
        }
      ],
      nextId: 1
    });
  });

  it('should handle TOGGLE_EXPAND', () => {
    expect(
      NotificationCenterReducer(
        {
          expanded: false,
          groups: [
            {
              id: 'danger',
              messages: [],
              title: 'danger',
              variant: 'danger'
            }
          ],
          nextId: 0
        },
        NotificationCenterActions.toggleNotificationCenter()
      )
    ).toEqual({
      expanded: true,
      groups: [
        {
          id: 'danger',
          messages: [],
          title: 'danger',
          variant: 'danger'
        }
      ],
      nextId: 0
    });
  });
});
