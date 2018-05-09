import { MessageType } from '../types/MessageCenter';
import { MessageCenterState } from '../store/Store';
import { MessageCenterActionKeys } from '../actions/MessageCenterActions';

const INITIAL_STATE: MessageCenterState = {
  nextId: 0,
  groups: [
    {
      id: 'default',
      title: 'Default',
      messages: []
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
    seen: false,
    created: new Date()
  };
};

const Messages = (state: MessageCenterState = INITIAL_STATE, action) => {
  switch (action.type) {
    case MessageCenterActionKeys.MESSAGE_CENTER_ADD: {
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
    case MessageCenterActionKeys.MESSAGE_CENTER_REMOVE: {
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
    case MessageCenterActionKeys.MESSAGE_CENTER_MARK_AS_READ: {
      const messageId = action.messageId;
      const groups = state.groups.map(group => {
        group = Object.assign({}, group, {
          messages: group.messages.map(message => {
            if (messageId.includes(message.id)) {
              message = Object.assign({}, message, { seen: true });
            }
            return message;
          })
        });
        return group;
      });
      return mergeToState(state, { groups });
    }
    case MessageCenterActionKeys.MESSAGE_CENTER_SHOW:
      if (state.hidden) {
        return mergeToState(state, { hidden: false });
      }
      return state;
    case MessageCenterActionKeys.MESSAGE_CENTER_HIDE:
      if (!state.hidden) {
        return mergeToState(state, { hidden: true });
      }
      return state;
    case MessageCenterActionKeys.MESSAGE_CENTER_TOGGLE_EXPAND:
      return mergeToState(state, { expanded: !state.expanded });

    case MessageCenterActionKeys.MESSAGE_CENTER_TOGGLE_GROUP: {
      const { groupId } = action;
      if (state.expandedGroupId === groupId) {
        return mergeToState(state, { expandedGroupId: undefined });
      }
      return mergeToState(state, { expandedGroupId: groupId });
    }

    default:
      return state;
  }
};

export default Messages;
