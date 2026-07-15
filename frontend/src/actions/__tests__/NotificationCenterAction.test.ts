import type { Store } from 'redux';
import { createStore, applyMiddleware, combineReducers } from 'redux';
import { NotificationCenterActions } from '../NotificationCenterActions';
import { NotificationCenterThunkActions } from '../NotificationCenterThunkActions';
import type { NotificationCenterState } from '../../store/Store';
import { MessageType } from '../../types/NotificationCenter';
import { NotificationCenterReducer } from '../../reducers/NotificationCenter';

const reduxThunkModule = require('redux-thunk');
const thunk = reduxThunkModule.thunk ?? reduxThunkModule.default;

interface TestState {
  notificationCenter: NotificationCenterState;
}

const createTestStore = (initialGroups?: any[]): { idsByGroup: Map<string, number[]>; store: Store<TestState> } => {
  const store = createStore(
    combineReducers({ notificationCenter: NotificationCenterReducer }),
    undefined,
    applyMiddleware(thunk)
  ) as Store<TestState>;
  if (initialGroups) {
    // Populate groups by dispatching addMessage for each message in each group,
    // then collect the assigned IDs so tests can assert on them.
    const idsByGroup = new Map<string, number[]>();
    for (const group of initialGroups) {
      const ids: number[] = [];
      for (const msg of group.messages) {
        store.dispatch(
          NotificationCenterActions.addMessage(
            msg.content ?? `msg-${msg.id}`,
            '',
            group.id,
            group.id as MessageType,
            false
          )
        );
        const currentGroup = store.getState().notificationCenter.groups.find(g => g.id === group.id)!;
        ids.push(currentGroup.messages[currentGroup.messages.length - 1].id);
      }
      idsByGroup.set(group.id, ids);
    }
    return { store, idsByGroup };
  }
  return { store, idsByGroup: new Map<string, number[]>() };
};

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
  it('should only mark selected group as read', async () => {
    const { store, idsByGroup } = createTestStore([
      { id: MessageType.DANGER, messages: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      { id: MessageType.WARNING, messages: [{ id: 5 }, { id: 6 }, { id: 7 }] }
    ]);

    const dangerIds = idsByGroup.get(MessageType.DANGER)!;
    await store.dispatch(NotificationCenterThunkActions.markGroupAsRead(MessageType.DANGER) as any);

    const dangerGroup = store.getState().notificationCenter.groups.find(g => g.id === MessageType.DANGER)!;
    const warningGroup = store.getState().notificationCenter.groups.find(g => g.id === MessageType.WARNING)!;

    dangerGroup.messages.forEach(msg => {
      if (dangerIds.includes(msg.id)) {
        expect(msg.seen).toBe(true);
      }
    });
    warningGroup.messages.forEach(msg => {
      expect(msg.seen).toBe(false);
    });
  });
  it('should only clear messages of selected group', async () => {
    const { store } = createTestStore([
      { id: MessageType.DANGER, messages: [{ id: 1 }, { id: 2 }, { id: 3 }] },
      { id: MessageType.WARNING, messages: [{ id: 5 }, { id: 6 }, { id: 7 }] }
    ]);

    await store.dispatch(NotificationCenterThunkActions.clearGroup(MessageType.WARNING) as any);

    const dangerGroup = store.getState().notificationCenter.groups.find(g => g.id === MessageType.DANGER)!;
    const warningGroup = store.getState().notificationCenter.groups.find(g => g.id === MessageType.WARNING)!;

    expect(dangerGroup.messages.length).toBe(3);
    expect(warningGroup.messages.length).toBe(0);
  });
});
