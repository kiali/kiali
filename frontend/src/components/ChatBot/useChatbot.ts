import { useState, useEffect, useRef, Dispatch, SetStateAction } from 'react';
import axios from 'axios';
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
};

export const useChatbot = (userName: string, provider: ProviderAI, model: ModelAI): UseChatbotResult => {
  const isMountedRef = useRef(true);
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelAI>(model);
  const [selectedProvider, setSelectedProvider] = useState<ProviderAI>(provider);
  const [alertMessage, setAlertMessage] = useState<AlertMessage | undefined>(INITIAL_NOTICE);
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);

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

  const show429Message = async (): Promise<void> => {
    // Insert a 3-sec delay before showing the "Too Many Request" message
    // for reducing the number of chat requests when the server is busy.
    await delay(3000);
    const newBotMessage = {
      ...tooManyRequestsMessage()
    };
    addMessage(newBotMessage);
  };
  const botMessage = (response: ChatResponse | string): ExtendedMessage => {
    const rawContent =
      typeof response === 'object' ? (typeof response.answer === 'string' ? response.answer : '') : response;
    const safeContent = typeof rawContent === 'string' ? rawContent : String(rawContent);
    const isMockApi = process.env.REACT_APP_MOCK_API === 'true';
    const content = isMockApi ? safeContent : escapeHtml(safeContent);
    const message: ExtendedMessage = {
      role: 'bot',
      content,
      name: botName,
      avatar: logo,
      timestamp: getTimestamp(),
      referenced_documents: typeof response === 'object' ? response.citations : []
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
      context: context
    };
    setIsLoading(true);

    try {
      const resp = await API.postChatAI(selectedProvider.name, selectedModel.name, chatRequest);

      if (resp.status === 200) {
        const chatResponse: ChatResponse = resp.data;
        const referenced_documents = chatResponse.citations;

        const newBotMessage: any = botMessage(chatResponse);
        newBotMessage.referenced_documents = referenced_documents;
        if (chatResponse.actions && chatResponse.actions.length > 0) {
          const navigationActions = chatResponse.actions.filter(action => action.kind === 'navigation');
          const alwaysNavigate = localStorage.getItem(CHATBOT_CONVERSATION_ALWAYS_NAVIGATE) === 'true';

          if (navigationActions.length > 0) {
            newBotMessage.content =
              alwaysNavigate && navigationActions.length === 1
                ? `Ok, navigating to the ${navigationActions[0].title}...`
                : 'Here is the link provided for the ChatBot:';
          }

          if (alwaysNavigate && navigationActions.length === 1) {
            router.navigate(navigationActions[0].payload);
          } else {
            newBotMessage.actions = chatResponse.actions;
          }
        }
        if (isMountedRef.current) {
          addMessage(newBotMessage);
        }
      } else {
        const errorMessage = resp.data?.error || `Bot returned status_code ${resp.status}`;
        if (isMountedRef.current) {
          setAlertMessage({
            title: 'Error',
            message: errorMessage,
            variant: 'danger'
          });
        }
      }
    } catch (e) {
      if (isTimeoutError(e)) {
        if (isMountedRef.current) {
          addMessage(timeoutMessage());
        }
      } else if (isTooManyRequestsError(e)) {
        if (isMountedRef.current) {
          await show429Message();
        }
      } else {
        const errorMessage = axios.isAxiosError(e)
          ? e.response?.data?.error || e.message
          : e instanceof Error
          ? e.message
          : String(e);
        if (isMountedRef.current) {
          setAlertMessage({
            title: 'Error',
            message: `An unexpected error occurred: ${errorMessage}`,
            variant: 'danger'
          });
        }
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
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
    setSelectedProvider
  };
};
