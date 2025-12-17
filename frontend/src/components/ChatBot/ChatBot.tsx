import React, { useCallback, useEffect, useRef, useState } from 'react';
import { t } from 'utils/I18nUtils';
import {
  Chatbot,
  ChatbotConversationHistoryNav,
  ChatbotDisplayMode,
  ChatbotToggle,
  Conversation
} from '@patternfly/chatbot';
import '@patternfly/chatbot/dist/css/main.css';
import { Theme } from 'types/Common';
import { useKialiTheme } from 'utils/ThemeUtils';
import { ChatBotHeader } from './ChatBotHeader';
import { KialiAppState } from 'store/Store';
import { connect } from 'react-redux';
import { useChatbot } from './useChatbot';
import { ChatBotFooter } from './ChatBotFooter';
import { ExtendedMessage, ModelAI } from 'types/Chatbot';
import { ChatBotContent } from './ChatBotContent';
import { CHAT_HISTORY_HEADER } from 'config/Constants';
import { ToggleIcon } from './icons/ToogleIcon';

type ReduxStateProps = {
  username: string;
  context: any;
  models: ModelAI[];
  defaultModel: string;
};

type ChatBotProps = ReduxStateProps;

const conversationList: { [key: string]: Conversation[] } = {};
conversationList[CHAT_HISTORY_HEADER] = [];

export const conversationStore: Map<string, ExtendedMessage[]> = new Map();

const resetConversationState = () => {
  conversationList[CHAT_HISTORY_HEADER] = [];
  conversationStore.clear();
};

const findMatchingItems = (targetValue: string) => {
  let filteredConversations = Object.entries(conversationList).reduce((acc: any, [key, items]) => {
    const filteredItems = items.filter(item => {
      const target = targetValue.toLowerCase();
      if (target.length === 0) {
        return true;
      }
      const msgs = conversationStore.get(item.id);
      if (!msgs) {
        return false;
      } else {
        for (const msg of msgs) {
          if (msg.content?.toLowerCase().includes(target)) {
            return true;
          }
        }
      }
      return false;
    });
    if (filteredItems.length > 0) {
      acc[key] = filteredItems;
    }
    return acc;
  }, {});
  // append message if no items are found
  if (Object.keys(filteredConversations).length === 0) {
    filteredConversations = [{ id: '13', noIcon: true, text: 'No results found' }];
  }
  return filteredConversations;
};

export const ChatBotComponent: React.FC<ChatBotProps> = (props: ChatBotProps) => {
  const {
    handleSend,
    alertMessage,
    botMessage,
    conversationId,
    selectedModel,
    setSelectedModel,
    setConversationId,
    messages,
    isLoading,
    setAlertMessage,
    setMessages
  } = useChatbot(props.username, props.models.filter(model => model.name === props.defaultModel)[0]);

  const theme = useKialiTheme();
  const isDarkTheme = theme === Theme.DARK;
  const [chatbotVisible, setChatbotVisible] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<ChatbotDisplayMode>(ChatbotDisplayMode.default);
  const [conversations, setConversations] = useState<Conversation[] | { [key: string]: Conversation[] }>(
    conversationList
  );
  const historyRef = useRef<HTMLButtonElement>(null);

  const setCurrentConversation = (newConversationId: string | undefined, newMessages: ExtendedMessage[]) => {
    if (messages.length > 0 && conversationId) {
      const chatHistory = conversationList[CHAT_HISTORY_HEADER];
      let found = false;
      for (const chat of chatHistory) {
        if (chat.id === conversationId) {
          found = true;
          break;
        }
      }
      if (!found) {
        chatHistory.push({
          id: conversationId,
          text: messages[0].content || '<<empty>>'
        });
        setConversations(conversationList);
      }
      conversationStore.set(conversationId, messages);
    }
    if (newMessages !== messages) {
      setMessages(newMessages);
    }
    if (newConversationId !== conversationId) {
      setConversationId(newConversationId);
    }
  };

  const onHandleSend = (msg: string | number) => {
    handleSend(msg, props.context);
  };

  const setDockedSize = useCallback(() => {
    const drawer = document.querySelector('.pf-v6-c-page__drawer') as HTMLElement | null;
    const mainContainer = document.querySelector('.pf-v6-c-page__main-container') as HTMLElement | null;
    const target = drawer ?? mainContainer;

    if (target) {
      const { height, width } = target.getBoundingClientRect();
      document.documentElement.style.setProperty('--kiali-chatbot-docked-height', `${height}px`);
      document.documentElement.style.setProperty('--kiali-chatbot-fullscreen-height', `${height}px`);
      document.documentElement.style.setProperty('--kiali-chatbot-fullscreen-width', `${width}px`);
    }
  }, []);

  useEffect(() => {
    setDockedSize();
    window.addEventListener('resize', setDockedSize);
    return () => {
      window.removeEventListener('resize', setDockedSize);
      document.documentElement.style.removeProperty('--kiali-chatbot-docked-height');
      document.documentElement.style.removeProperty('--kiali-chatbot-fullscreen-height');
      document.documentElement.style.removeProperty('--kiali-chatbot-fullscreen-width');
    };
  }, [setDockedSize]);

  useEffect(() => {
    setDockedSize();
  }, [setDockedSize, displayMode, isDrawerOpen, chatbotVisible]);

  useEffect(
    () =>
      // Fired on component mount (componentDidMount)
      () => {
        // Anything in here is fired on component unmount (componentWillUnmount)
        resetConversationState();
      },
    []
  );

  const onSelectDisplayMode = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => {
    setDisplayMode(value as ChatbotDisplayMode);
  };

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000
      }}
    >
      <ChatbotToggle
        tooltipLabel={t('Chat with AI')}
        isChatbotVisible={chatbotVisible}
        onToggleChatbot={() => setChatbotVisible(!chatbotVisible)}
        closedToggleIcon={() => ToggleIcon(isDarkTheme)}
      />
      <Chatbot isVisible={chatbotVisible} displayMode={displayMode}>
        <ChatbotConversationHistoryNav
          displayMode={displayMode}
          onDrawerToggle={() => {
            setIsDrawerOpen(!isDrawerOpen);
            setConversations(conversationList);
          }}
          isDrawerOpen={isDrawerOpen}
          setIsDrawerOpen={setIsDrawerOpen}
          activeItemId="1"
          onSelectActiveItem={(_, selectedId: any) => {
            if (selectedId) {
              const retrievedMessages = conversationStore.get(selectedId);
              if (retrievedMessages) {
                setCurrentConversation(selectedId, retrievedMessages);
                setIsDrawerOpen(!isDrawerOpen);
                setConversations(conversationList);
              }
            }
          }}
          conversations={conversations}
          onNewChat={() => {
            setIsDrawerOpen(!isDrawerOpen);
            setCurrentConversation(undefined, []);
          }}
          handleTextInputChange={(value: string) => {
            if (value === '') {
              setConversations(conversationList);
            }
            // this is where you would perform search on the items in the drawer
            // and update the state
            const newConversations: { [key: string]: Conversation[] } = findMatchingItems(value);
            setConversations(newConversations);
          }}
          drawerContent={
            <>
              <ChatBotHeader
                displayMode={displayMode}
                isDrawerOpen={isDrawerOpen}
                onToggleDrawer={() => setIsDrawerOpen(!isDrawerOpen)}
                onSelectDisplayMode={onSelectDisplayMode}
                onCloseChat={() => setChatbotVisible(!chatbotVisible)}
                historyRef={historyRef}
                models={props.models}
                selectedModel={selectedModel}
                onSelectModel={setSelectedModel}
              />
              <ChatBotContent
                username={props.username}
                alertMessage={alertMessage}
                handleSend={handleSend}
                setAlertMessage={setAlertMessage}
                messages={messages}
                isLoading={isLoading}
                botMessage={botMessage}
                context={props.context}
              />
              <ChatBotFooter setAlertMessage={() => setAlertMessage(undefined)} handleSend={onHandleSend} />
            </>
          }
        />
      </Chatbot>
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  username: state.authentication.session?.username ?? '',
  context: state.chatAi.context,
  models: state.chatAi.models,
  defaultModel: state.chatAi.defaultModel
});

export const ChatBot = connect(mapStateToProps)(ChatBotComponent);
