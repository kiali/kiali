import { List as ImmutableList, Map as ImmutableMap } from 'immutable';
import { ChatAIState } from '../store/Store';
import { KialiAppAction } from '../actions/KialiAppAction';
import { getType } from 'typesafe-actions';
import { ChatAIActions } from 'actions/ChatAIActions';

export const INITIAL_CHAT_AI_STATE: ChatAIState =
  ImmutableMap({
    chatHistory: ImmutableList(),
    conversationID: '',
    openTool: ImmutableMap({ chatEntryIndex: null, id: null }),
    query: ''
  })  


// This Reducer allows changes to the 'globalState' portion of Redux Store
export const ChatAiStateReducer = (state: ChatAIState = INITIAL_CHAT_AI_STATE, action: KialiAppAction): ChatAIState => {
  switch (action.type) {   
    case getType(ChatAIActions.chatHistoryClear):
      return state.set('chatHistory', ImmutableList());
    case getType(ChatAIActions.chatHistoryPush): {
      return state.set(
        'chatHistory',
        state.get('chatHistory').push(ImmutableMap(action.payload.entry)),
      );
    }      
    case getType(ChatAIActions.chatHistoryUpdateByID): {
      const index = state
        .get('chatHistory')
        .findIndex((entry) => entry.get('id') === action.payload.id);
      return state.mergeIn(['chatHistory', index], action.payload.entry);
    }
    case getType(ChatAIActions.chatHistoryUpdateTool): {
      const index = state
        .get('chatHistory')
        .findIndex((entry) => entry.get('id') === action.payload.id);
      return state.mergeIn(
        ['chatHistory', index, 'tools', action.payload.toolID],
        action.payload.tool,
      );    
    }
    case getType(ChatAIActions.chatOpenToolSet): {
      return state
        .setIn(['openTool', 'chatEntryIndex'], action.payload.chatEntryIndex)
        .setIn(['openTool', 'id'], action.payload.id);
    }
    case getType(ChatAIActions.chatOpenToolClear): {
      return state.setIn(['openTool', 'chatEntryIndex'], null).setIn(['openTool', 'id'], null);
    }
    case getType(ChatAIActions.chatSetConversationID): {
      return state.set('conversationID', action.payload.id);
    }
    case getType(ChatAIActions.chatSetQuery): {
      return state.set('query', action.payload.query);
    }
    default:
      return state;
  }
};
