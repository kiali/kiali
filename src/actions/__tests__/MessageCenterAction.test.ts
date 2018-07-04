import { MessageCenterActions, MessageCenterActionKeys } from '../MessageCenterActions';
import { MessageType } from '../../types/MessageCenter';

import thunk from 'redux-thunk';
import configureMockStore from 'redux-mock-store';

const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

describe('MessageCenterActions', () => {
  it('should add a message', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.ADD_MESSAGE,
      content: 'my message',
      groupId: 'great-messages',
      messageType: MessageType.WARNING
    };
    expect(MessageCenterActions.addMessage('my message', 'great-messages', MessageType.WARNING)).toEqual(
      expectedAction
    );
  });
  it('should remove a single message', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.REMOVE_MESSAGE,
      messageId: [5]
    };
    expect(MessageCenterActions.removeMessage(5)).toEqual(expectedAction);
  });
  it('should remove multiple messages', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.REMOVE_MESSAGE,
      messageId: [5, 6, 8]
    };
    expect(MessageCenterActions.removeMessage([5, 6, 8])).toEqual(expectedAction);
  });
  it('should mark as read a single message', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.MARK_MESSAGE_AS_READ,
      messageId: [3]
    };
    expect(MessageCenterActions.markAsRead(3)).toEqual(expectedAction);
  });
  it('should mark as read multiple messages', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.MARK_MESSAGE_AS_READ,
      messageId: [1, 2, 3, 4]
    };
    expect(MessageCenterActions.markAsRead([1, 2, 3, 4])).toEqual(expectedAction);
  });
  it('should toggle group', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.TOGGLE_GROUP,
      groupId: 'my-awesome-group'
    };
    expect(MessageCenterActions.toggleGroup('my-awesome-group')).toEqual(expectedAction);
  });
  it('should hide a single notification', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.HIDE_NOTIFICATION,
      messageId: [2]
    };
    expect(MessageCenterActions.hideNotification(2)).toEqual(expectedAction);
  });
  it('should hide a multiple notifications', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.HIDE_NOTIFICATION,
      messageId: [8, 9, 7]
    };
    expect(MessageCenterActions.hideNotification([8, 9, 7])).toEqual(expectedAction);
  });
  it('should show the message center', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.SHOW
    };
    expect(MessageCenterActions.showMessageCenter()).toEqual(expectedAction);
  });
  it('should hide the message center', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.HIDE
    };
    expect(MessageCenterActions.hideMessageCenter()).toEqual(expectedAction);
  });
  it('should toggle the exapended state of the message center', () => {
    const expectedAction = {
      type: MessageCenterActionKeys.TOGGLE_EXPAND
    };
    expect(MessageCenterActions.togleExpandedMessageCenter()).toEqual(expectedAction);
  });
  it('should open a closed message center', () => {
    const expectedActions = [
      {
        type: MessageCenterActionKeys.SHOW
      }
    ];
    const store = mockStore({ messageCenter: { hidden: true } });
    return store.dispatch(MessageCenterActions.toggleMessageCenter()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should close an opened message center', () => {
    const expectedActions = [
      {
        type: MessageCenterActionKeys.HIDE
      }
    ];
    const store = mockStore({ messageCenter: { hidden: false } });
    return store.dispatch(MessageCenterActions.toggleMessageCenter()).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should only mark selected group as read', () => {
    const expectedActions = [
      {
        type: MessageCenterActionKeys.MARK_MESSAGE_AS_READ,
        messageId: [1, 2, 3]
      }
    ];
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
    return store.dispatch(MessageCenterActions.markGroupAsRead('my-group')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
  it('should only clear messages of selected group', () => {
    const expectedActions = [
      {
        type: MessageCenterActionKeys.REMOVE_MESSAGE,
        messageId: [5, 6, 7]
      }
    ];
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
    return store.dispatch(MessageCenterActions.clearGroup('other')).then(() => {
      expect(store.getActions()).toEqual(expectedActions);
    });
  });
});
