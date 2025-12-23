import { useState } from 'react';
import axios from 'axios';
import { AlertMessage, ChatRequest, ChatResponse, ContextRequest, ExtendedMessage, ModelAI } from '../../types/Chatbot';
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

const botName = document.getElementById('bot_name')?.innerText ?? KIALI_PRODUCT_NAME;

const getTimestamp = () => {
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

const isTimeoutError = (e: any) => axios.isAxiosError(e) && e.message === `timeout of ${API_TIMEOUT}ms exceeded`;

const isTooManyRequestsError = (e: any) => axios.isAxiosError(e) && e.response?.status === 429;

export const timeoutMessage = (): ExtendedMessage => fixedMessage(TIMEOUT_MSG);

export const tooManyRequestsMessage = (): ExtendedMessage => fixedMessage(TOO_MANY_REQUESTS_MSG);

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

const escapeHtml = (unsafe: string): string => unsafe.replace(/`/g, '*');

export const useChatbot = (userName: string, model: ModelAI) => {
  const [messages, setMessages] = useState<ExtendedMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedModel, setSelectedModel] = useState<ModelAI>(model);
  const [alertMessage, setAlertMessage] = useState<AlertMessage | undefined>(INITIAL_NOTICE);
  const [conversationId, setConversationId] = useState<string | null | undefined>(undefined);

  const addMessage = (newMessage: ExtendedMessage, addAfter?: ExtendedMessage) => {
    setMessages((msgs: ExtendedMessage[]) => {
      const newMsgs: ExtendedMessage[] = [];
      let inserted = false;
      for (const msg of msgs) {
        newMsgs.push(msg);
        if (msg === addAfter) {
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

  const show429Message = async () => {
    // Insert a 3-sec delay before showing the "Too Many Request" message
    // for reducing the number of chat requests when the server is busy.
    await delay(3000);
    const newBotMessage = {
      ...tooManyRequestsMessage()
    };
    addMessage(newBotMessage);
  };
  const botMessage = (response: ChatResponse | string, _ = ''): ExtendedMessage => {
    const message: ExtendedMessage = {
      role: 'bot',
      content: typeof response === 'object' ? escapeHtml(response.answer) : escapeHtml(response),
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
    const random = () => Math.random().toString(16).slice(2);
    return `${Date.now().toString(16)}-${random()}-${random()}`;
  };

  const handleSend = async (
    query: string | number,
    context: ContextRequest,
    prompt: string | undefined = undefined
  ) => {
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
      const resp = await API.postChatAI(selectedModel.name, chatRequest);

      if (resp.status === 200) {
        const chatResponse: ChatResponse = resp.data;
        const referenced_documents = chatResponse.citations;

        const newBotMessage: any = botMessage(chatResponse, query.toString());
        newBotMessage.referenced_documents = referenced_documents;
        addMessage(newBotMessage);
      } else {
        setAlertMessage({
          title: 'Error',
          message: `Bot returned status_code ${resp.status}`,
          variant: 'danger'
        });
      }
    } catch (e) {
      if (isTimeoutError(e)) {
        addMessage(timeoutMessage());
      } else if (isTooManyRequestsError(e)) {
        await show429Message();
      } else {
        setAlertMessage({
          title: 'Error',
          message: `An unexpected error occurred: ${e}`,
          variant: 'danger'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

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
    setSelectedModel
  };
};
