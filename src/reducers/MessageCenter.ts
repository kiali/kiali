import { MessageType } from '../types/MessageCenter';
import { MessageCenterState } from '../store/Store';
import { MessageCenterActionKeys } from '../actions/MessageCenterActions';

const INITIAL_STATE: MessageCenterState = {
  nextId: 0,
  groups: [
    {
      id: 'systemErrors',
      title: 'Open issues',
      messages: [],
      showActions: false,
      hideIfEmpty: true
    },
    {
      id: 'default',
      title: 'Notifications',
      messages: [],
      showActions: true,
      hideIfEmpty: false
    }
  ],
  hidden: true,
  expanded: false,
  expandedGroupId: 'default'
};

const mergeToState = (prevState, toMerge) => ({ ...prevState, ...toMerge });

const createMessage = (id: number, content: string, type: MessageType) => {
  return {
    id,
    content,
    type,
    show_notification: type === MessageType.ERROR || type === MessageType.WARNING,
    seen: false,
    created: new Date()
  };
};

// Updates several messages with the same payload, useful for marking messages
// returns the updated state
const updateMessage = (state: MessageCenterState, messageIds: number[], updater) => {
  const groups = state.groups.map(group => {
    group = Object.assign({}, group, {
      messages: group.messages.map(message => {
        if (messageIds.includes(message.id)) {
          message = updater(message);
        }
        return message;
      })
    });
    return group;
  });
  return mergeToState(state, { groups });
};

const Messages = (state: MessageCenterState = INITIAL_STATE, action) => {
  switch (action.type) {
    case MessageCenterActionKeys.ADD_MESSAGE: {
      const { groupId, content, messageType } = action;
      const groups = state.groups.map(group => {
        if (group.id === groupId) {
          group = Object.assign({}, group, {
            messages: group.messages.concat([createMessage(state.nextId, content, messageType)])
          });
          return group;
        }
        return group;
      });
      return mergeToState(state, { groups: groups, nextId: state.nextId + 1 });
    }
    case MessageCenterActionKeys.REMOVE_MESSAGE: {
      const messageId = action.messageId;
      const groups = state.groups.map(group => {
        group = Object.assign({}, group, {
          messages: group.messages.filter(message => {
            return !messageId.includes(message.id);
          })
        });
        return group;
      });
      return mergeToState(state, { groups });
    }
    case MessageCenterActionKeys.MARK_MESSAGE_AS_READ: {
      return updateMessage(state, action.messageId, message => ({ ...message, seen: true, show_notification: false }));
    }
    case MessageCenterActionKeys.HIDE_NOTIFICATION: {
      return updateMessage(state, action.messageId, message => ({ ...message, show_notification: false }));
    }
    case MessageCenterActionKeys.SHOW:
      if (state.hidden) {
        return mergeToState(state, { hidden: false });
      }
      return state;
    case MessageCenterActionKeys.HIDE:
      if (!state.hidden) {
        return mergeToState(state, { hidden: true });
      }
      return state;
    case MessageCenterActionKeys.TOGGLE_EXPAND:
      return mergeToState(state, { expanded: !state.expanded });
    case MessageCenterActionKeys.TOGGLE_GROUP: {
      const { groupId } = action;
      if (state.expandedGroupId === groupId) {
        return mergeToState(state, { expandedGroupId: undefined });
      }
      return mergeToState(state, { expandedGroupId: groupId });
    }
    case MessageCenterActionKeys.EXPAND_GROUP: {
      const { groupId } = action;
      return mergeToState(state, { expandedGroupId: groupId });
    }

    default:
      return state;
  }
};

export default Messages;
