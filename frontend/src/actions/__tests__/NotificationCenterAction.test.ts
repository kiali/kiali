import { NotificationCenterActions } from '../NotificationCenterActions';
import { NotificationCenterThunkActions } from '../NotificationCenterThunkActions';
import { MessageType } from '../../types/NotificationCenter';
import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('NotificationCenterActions', () => {
  it('should add a message', () => {
    const expectedPayload = {
      content: 'my message',
      detail: 'my detail',
      groupId: 'great-messages',
      messageType: MessageType.WARNING,
      isAlert: true
    };
    const action = NotificationCenterActions.addMessage(
      'my message',
      'my detail',
      'great-messages',
      MessageType.WARNING,
      true
    );
    expect(action.payload).toEqual(expectedPayload);
  });
  it('should remove a single message', () => {
    const action = NotificationCenterActions.removeMessage(5);
    expect(action.payload.messageId).toEqual([5]);
  });
  it('should remove multiple messages', () => {
    const action = NotificationCenterActions.removeMessage([5, 6, 8]);
    expect(action.payload.messageId).toEqual([5, 6, 8]);
  });
  it('should mark as read a single message', () => {
    const action = NotificationCenterActions.markAsRead(3);
    expect(action.payload.messageId).toEqual([3]);
  });
  it('should mark as read multiple messages', () => {
    const action = NotificationCenterActions.markAsRead([1, 2, 3, 4]);
    expect(action.payload.messageId).toEqual([1, 2, 3, 4]);
  });
  it('should hide a single notification', () => {
    const action = NotificationCenterActions.hideNotification(2);
    expect(action.payload.messageId).toEqual([2]);
  });
  it('should hide a multiple notifications', () => {
    const action = NotificationCenterActions.hideNotification([8, 9, 7]);
    expect(action.payload.messageId).toEqual([8, 9, 7]);
  });
  it('should only mark selected group as read', () => {
    const expectedActions = [NotificationCenterActions.markAsRead([1, 2, 3])];
    const store = mockStore({
      notificationCenter: {
        groups: [
          {
            id: 'my-group',
            messages: [{ id: 1 }, { id: 2 }, { id: 3 }]
          },
          {
            id: 'other',
            messages: [{ id: 5 }, { id: 6 }, { id: 7 }]
          }
        ]
      }
    });
    return store.dispatch(NotificationCenterThunkActions.markGroupAsRead('my-group')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should only clear messages of selected group', () => {
    const expectedActions = [NotificationCenterActions.removeMessage([5, 6, 7])];
    const store = mockStore({
      notificationCenter: {
        groups: [
          {
            id: 'my-group',
            messages: [{ id: 1 }, { id: 2 }, { id: 3 }]
          },
          {
            id: 'other',
            messages: [{ id: 5 }, { id: 6 }, { id: 7 }]
          }
        ]
      }
    });
    return store.dispatch(NotificationCenterThunkActions.clearGroup('other')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
});
