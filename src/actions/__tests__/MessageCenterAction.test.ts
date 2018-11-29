import { MessageCenterActions } from '../MessageCenterActions';
import MessageCenterThunkActions from '../MessageCenterThunkActions';
import { MessageType } from '../../types/MessageCenter';

import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('MessageCenterActions', () => {
  it('should add a message', () => {
    const expectedPayload = {
      content: 'my message',
      groupId: 'great-messages',
      messageType: MessageType.WARNING
    };
    const action = MessageCenterActions.addMessage('my message', 'great-messages', MessageType.WARNING);
    expect(action.payload).toEqual(expectedPayload);
  });
  it('should remove a single message', () => {
    const action = MessageCenterActions.removeMessage(5);
    expect(action.payload.messageId).toEqual([5]);
  });
  it('should remove multiple messages', () => {
    const action = MessageCenterActions.removeMessage([5, 6, 8]);
    expect(action.payload.messageId).toEqual([5, 6, 8]);
  });
  it('should mark as read a single message', () => {
    const action = MessageCenterActions.markAsRead(3);
    expect(action.payload.messageId).toEqual([3]);
  });
  it('should mark as read multiple messages', () => {
    const action = MessageCenterActions.markAsRead([1, 2, 3, 4]);
    expect(action.payload.messageId).toEqual([1, 2, 3, 4]);
  });
  it('should toggle group', () => {
    const action = MessageCenterActions.toggleGroup('my-awesome-group');
    expect(action.payload.groupId).toEqual('my-awesome-group');
  });
  it('should hide a single notification', () => {
    const action = MessageCenterActions.hideNotification(2);
    expect(action.payload.messageId).toEqual([2]);
  });
  it('should hide a multiple notifications', () => {
    const action = MessageCenterActions.hideNotification([8, 9, 7]);
    expect(action.payload.messageId).toEqual([8, 9, 7]);
  });
  it('should open a closed message center', () => {
    const expectedActions = [MessageCenterActions.showMessageCenter(), MessageCenterActions.expandGroup('default')];
    const store = mockStore({ messageCenter: { hidden: true } });
    return store.dispatch(MessageCenterThunkActions.toggleMessageCenter()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should close an opened message center', () => {
    const expectedActions = [MessageCenterActions.hideMessageCenter()];
    const store = mockStore({ messageCenter: { hidden: false } });
    return store.dispatch(MessageCenterThunkActions.toggleMessageCenter()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should only mark selected group as read', () => {
    const expectedActions = [MessageCenterActions.markAsRead([1, 2, 3])];
    const store = mockStore({
      messageCenter: {
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
    return store.dispatch(MessageCenterThunkActions.markGroupAsRead('my-group')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should only clear messages of selected group', () => {
    const expectedActions = [MessageCenterActions.removeMessage([5, 6, 7])];
    const store = mockStore({
      messageCenter: {
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
    return store.dispatch(MessageCenterThunkActions.clearGroup('other')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
});
