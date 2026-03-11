import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import { Map as ImmutableMap } from 'immutable';
import axios from 'axios';
import { throttle, uniqueId } from 'lodash-es';
import {
  AlertMessage,
  CHATBOT_CONVERSATION_ALWAYS_NAVIGATE,
  ChatRequest,
  ChatResponse,
  ContextRequest,
  ExtendedMessage,
  ModelAI,
  ProviderAI
} from '../../types/Chatbot';
import {
  API_TIMEOUT,
  INITIAL_NOTICE,
  KIALI_PRODUCT_NAME,
  TIMEOUT_MSG,
  TOO_MANY_REQUESTS_MSG
} from '../../config/Constants';
import * as API from '../../services/Api';
import userLogo from './icons/chat_avatar.svg';
import logo from './icons/kiali_logo.svg';
import { router } from 'app/History';
import { saveConversation } from 'utils/ConversationStorage';
import { useDispatch, useSelector } from 'react-redux';
import { chatHistoryPush, chatHistoryUpdateByID, chatHistoryUpdateTool } from 'actions/ChatAIActions';

const botName = document.getElementById('bot_name')?.innerText ?? KIALI_PRODUCT_NAME;

const getTimestamp = (): string => {
  const date = new Date();
  return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

export const fixedMessage = (content: string): ExtendedMessage => ({
  role: 'bot',
  content,
  name: botName,
  avatar: logo,
  timestamp: getTimestamp(),
  referenced_documents: []
});

const isTimeoutError = (e: any): boolean =>
  axios.isAxiosError(e) && e.message === `timeout of ${API_TIMEOUT}ms exceeded`;

const isTooManyRequestsError = (e: any): boolean => axios.isAxiosError(e) && e.response?.status === 429;

export const timeoutMessage = (): ExtendedMessage => fixedMessage(TIMEOUT_MSG);

export const tooManyRequestsMessage = (): ExtendedMessage => fixedMessage(TOO_MANY_REQUESTS_MSG);

const delay = (ms: number): Promise<void> => new Promise(res => setTimeout(res, ms));

const escapeHtml = (unsafe: string): string =>
  unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

type UseChatbotResult = {
  alertMessage: AlertMessage | undefined;
  botMessage: (response: ChatResponse | string) => ExtendedMessage;
  conversationId: string | null | undefined;
  handleSend: (query: string | number, context: ContextRequest, prompt?: string) => Promise<void>;
  isLoading: boolean;
  messages: ExtendedMessage[];
  selectedModel: ModelAI;
  selectedProvider: ProviderAI;
  setAlertMessage: Dispatch<SetStateAction<AlertMessage | undefined>>;
  setConversationId: Dispatch<SetStateAction<string | null | undefined>>;
  setMessages: Dispatch<SetStateAction<ExtendedMessage[]>>;
  setSelectedModel: Dispatch<SetStateAction<ModelAI>>;
  setSelectedProvider: Dispatch<SetStateAction<ProviderAI>>;
  isStreaming: boolean;
  setIsStreaming: Dispatch<SetStateAction<boolean>>;
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
};

export const useChatbot = (userName: string, provider: ProviderAI, model: ModelAI): UseChatbotResult => {
  const isMountedRef = useRef(true);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [query, setQuery] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelAI>(model);
  const [selectedProvider, setSelectedProvider] = useState<ProviderAI>(provider);
  const [alertMessage, setAlertMessage] = useState<AlertMessage | undefined>(INITIAL_NOTICE);
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);
  const dispatch = useDispatch();

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const addMessage = (newMessage: ExtendedMessage, addAfter?: ExtendedMessage): void => {
    setMessages((msgs: ExtendedMessage[]) => {
      // Clear actions from all previous messages while preserving object references for comparison
      const clearedMsgs = msgs.map(msg => {
        if (msg.actions) {
          const { actions, ...msgWithoutActions } = msg;
          return msgWithoutActions;
        }
        return msg;
      });

      const newMsgs: ExtendedMessage[] = [];
      let inserted = false;
      for (let i = 0; i < clearedMsgs.length; i++) {
        newMsgs.push(clearedMsgs[i]);
        // Compare with original message for addAfter check
        if (msgs[i] === addAfter) {
          newMsgs.push(newMessage);
          inserted = true;
        }
      }
      if (!inserted) {
        newMsgs.push(newMessage);
      }
      return newMsgs;
    });
  };

  const botMessage = (response: ChatResponse | string): ExtendedMessage => {
    const rawContent =
      typeof response === 'object' ? (typeof response.data.response === 'string' ? response.data.response : '') : response;
    const safeContent = typeof rawContent === 'string' ? rawContent : String(rawContent);
    const isMockApi = process.env.REACT_APP_MOCK_API === 'true';
    const content = isMockApi ? safeContent : escapeHtml(safeContent);
    const message: ExtendedMessage = {
      role: 'bot',
      content,
      name: botName,
      avatar: logo,
      timestamp: getTimestamp(),
      referenced_documents: typeof response === 'object' ? response.data.referenced_documents : []
    };

    return message;
  };

  const generateConversationId = (): string => {
    const g: any = typeof globalThis !== 'undefined' ? (globalThis as any) : {};
    if (g.crypto && typeof g.crypto.randomUUID === 'function') {
      return g.crypto.randomUUID();
    }
    const random = (): string => Math.random().toString(16).slice(2);
    return `${Date.now().toString(16)}-${random()}-${random()}`;
  };

  const handleSend = async (
    query: string | number,
    context: ContextRequest,
    prompt: string | undefined = undefined
  ): Promise<void> => {
    if (isStreaming) {
      return;
    }

    if (!query || query.trim().length === 0) {
      setValidated('error');
      return;
    }
    
    const userMessage: ExtendedMessage = {
      role: 'user',
      content: prompt ? prompt : query.toString(),
      name: userName,
      avatar: userLogo,
      timestamp: getTimestamp(),
      referenced_documents: []
    };
    addMessage(userMessage);


    let nextConversationId = conversationId ?? undefined;
    if (!nextConversationId) {
      nextConversationId = generateConversationId();
      setConversationId(nextConversationId);
    }

    const chatRequest: ChatRequest = {
      conversation_id: nextConversationId,
      query: query.toString(),
      media_type: 'application/json',
      context: context
    };
    setIsLoading(true);
    const chatEntryID = uniqueId('ChatEntry_');
    dispatch(
      chatHistoryPush({
        id: chatEntryID,
        isCancelled: false,
        isStreaming: true,
        isTruncated: false,
        references: [],
        text: '',
        tools: ImmutableMap(),
        who: 'ai',
      }),
    );   

    try {
      const resp = await API.postChatAI(selectedProvider.name, selectedModel.name, chatRequest);

      console.log("resp", resp);
      if (resp.status === 200) {
        const reader = resp.body?.getReader();
        if (!reader) throw new Error("No readable stream");
        const decoder = new TextDecoder();
        let responseText = '';

        const dispatchTokens = throttle(
          () => dispatch(chatHistoryUpdateByID({ id: chatEntryID, entry: { text: responseText } })),
          100,
          { leading: false, trailing: true },
        );
         // Use buffer because long strings (e.g. tool call output) may be split into multiple chunks
        let buffer = '';


        while(true){
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');

          // Keep the last line in the buffer. If the chunk ended mid-line, this holds the incomplete
          // line until more data arrives. If the chunk ended with '\n', split() produces an empty
          // string as the last element, so we just hold an empty buffer and process all lines.
          buffer = lines.pop() ?? '';
          lines
          .filter((s) => s.startsWith('data: '))
          .forEach((s) => {
            const line = s.slice(5).trim();
            let json;
            try {
              json = JSON.parse(line);
            } catch (parseError) {
              // eslint-disable-next-line no-console
              console.error(`Failed to parse JSON string "${line}"`, parseError);
            }
            if (json && json.event && json.data) {
              if (json.event === 'start') {
                setConversationId(json.data.conversation_id);
                console.log("start event");
              } else if (json.event === 'token') {
                responseText += json.data.token;
                dispatchTokens();
              } else if (json.event === 'end') {
                dispatchTokens.flush();
                dispatch(
                  chatHistoryUpdateByID({ id: chatEntryID, entry: {
                    isStreaming: false,
                    isTruncated: json.data.truncated === true,
                    references: json.data.referenced_documents,
                  }}),
                );
              } else if (json.event === 'tool_call') {
                const { args, id, name: toolName } = json.data;
                dispatch(chatHistoryUpdateTool({ id: chatEntryID, toolID: id, tool: { name: toolName, args } }));
              } else if (json.event === 'tool_result') {
                const { content, id, status } = json.data;
                dispatch(chatHistoryUpdateTool({ id: chatEntryID, toolID: id, tool: { content, status } }));
              } else if (json.event === 'error') {
                dispatchTokens.flush();
                dispatch(
                  chatHistoryUpdateByID({ id: chatEntryID, entry: {
                    error: {
                      message: json.data.detail,
                      response: resp,
                    },
                    isStreaming: false,
                  }}),
                );
              } else {
                console.warn(`Unrecognized event in response stream:`, JSON.stringify(json));
              }
            }
          });
        }      
      } else {
        console.error("Error in handleSend:", resp.statusText);
      }    
    } catch (error) {
      console.error("Error in handleSend:", error);
      setIsLoading(false);
      setIsStreaming(false);
      setAlertMessage({
        title: "Error",
        message: "An error occurred while sending the message",
        variant: "danger"
      });
    }
  };
  // Save conversation to storage whenever messages or conversationId changes
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      saveConversation(conversationId, messages);
    }
  }, [conversationId, messages]);

  return {
    messages,
    setMessages,
    botMessage,
    isLoading,
    handleSend,
    alertMessage,
    setAlertMessage,
    conversationId,
    setConversationId,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    setSelectedProvider,
    query,
    setQuery,
    isStreaming,
    setIsStreaming,
    
  };
};
