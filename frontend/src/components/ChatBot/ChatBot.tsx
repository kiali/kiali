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
import { ChatBotMock } from './ChatBotMock';
import { ContextRequest, ExtendedMessage, ProviderAI } from 'types/Chatbot';
import { ChatBotContent } from './ChatBotContent';
import { CHAT_HISTORY_HEADER } from 'config/Constants';
import { ToggleIcon } from './icons/ToogleIcon';
import * as API from 'services/Api';
import { saveConversation, loadConversations, loadConversation } from 'utils/ConversationStorage';

type ReduxStateProps = {
  context: ContextRequest;
  defaultProvider: string;
  providers: ProviderAI[];
  username: string;
};

type ChatBotProps = ReduxStateProps;

const conversationList: { [key: string]: Conversation[] } = {};
conversationList[CHAT_HISTORY_HEADER] = [];

export const conversationStore: Map<string, ExtendedMessage[]> = new Map();

const resetConversationState = (): void => {
  conversationList[CHAT_HISTORY_HEADER] = [];
  conversationStore.clear();
};

const findMatchingItems = (targetValue: string): { [key: string]: Conversation[] } => {
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
    filteredConversations = {
      [CHAT_HISTORY_HEADER]: [{ id: '13', noIcon: true, text: 'No results found' }]
    };
  }
  return filteredConversations;
};

export const ChatBotComponent: React.FC<ChatBotProps> = (props: ChatBotProps) => {
  const defaultProvider = props.providers.filter(provider => provider.name === props.defaultProvider)[0];
  const defaultModel = defaultProvider.models.filter(model => model.name === defaultProvider.defaultModel)[0];
  const {
    handleSend,
    alertMessage,
    botMessage,
    conversationId,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    setSelectedProvider,
    setConversationId,
    messages,
    isLoading,
    setAlertMessage,
    setMessages
  } = useChatbot(props.username, defaultProvider, defaultModel);

  const theme = useKialiTheme();
  const isDarkTheme = theme === Theme.DARK;

  const [chatbotVisible, setChatbotVisible] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<ChatbotDisplayMode>(ChatbotDisplayMode.default);
  const [conversations, setConversations] = useState<Conversation[] | { [key: string]: Conversation[] }>(
    conversationList
  );
  const [backendConversationIds, setBackendConversationIds] = useState<string[]>([]);
  const historyRef = useRef<HTMLButtonElement>(null);
  // Mock API
  const isMockApi = process.env.REACT_APP_MOCK_API === 'true';
  const [selectedMockConversation, setSelectedMockConversation] = useState<string>('Select one Mock Conversation');

  const handleSelectMockConversation = (conversation: string): void => {
    if (conversation === 'Select one Mock Conversation') {
      return;
    }
    setSelectedMockConversation(conversation);
    handleSend(conversation, props.context);
  };
  // End Mock API
  // Filter conversations to only show those matching backend IDs
  const updateConversationList = useCallback(() => {
    const chatHistory: Conversation[] = [];
    backendConversationIds.forEach(id => {
      const msgs = conversationStore.get(id);
      if (msgs && msgs.length > 0) {
        const firstMessage = msgs.find(msg => msg.role === 'user' || msg.role === 'bot');
        chatHistory.push({
          id: id,
          text: firstMessage?.content || '<<empty>>'
        });
      }
    });
    conversationList[CHAT_HISTORY_HEADER] = chatHistory;
    setConversations(conversationList);
  }, [backendConversationIds]);

  const onProviderChange = (provider: ProviderAI): void => {
    if (provider === selectedProvider) {
      return;
    }
    setSelectedProvider(provider);
    setIsDrawerOpen(false);
    setCurrentConversation(undefined, []);
    updateConversationList();
  };

  // Load conversations from backend and storage
  const loadConversationsFromBackend = useCallback(async (): Promise<void> => {
    try {
      const response = await API.getChatConversations();
      if (response.data) {
        const ids = response.data;

        // Find conversation IDs that are in backend but not in sessionStorage
        const conversationsToDelete: string[] = [];
        ids.forEach(id => {
          const storedConversation = loadConversation(id);
          if (!storedConversation) {
            // Conversation ID exists in backend but not in sessionStorage
            conversationsToDelete.push(id);
          }
        });

        // Delete conversations from backend that are not in sessionStorage
        if (conversationsToDelete.length > 0) {
          try {
            await API.deleteChatConversations(conversationsToDelete);
          } catch (error) {
            console.error('Failed to delete conversations from backend:', error);
          }
        }

        // Filter out deleted conversation IDs
        const remainingIds = ids.filter(id => !conversationsToDelete.includes(id));
        setBackendConversationIds(remainingIds);

        // Load conversations from storage that match remaining backend IDs
        const loadedConversations = loadConversations(remainingIds);
        const chatHistory: Conversation[] = [];

        // Populate conversationStore and chatHistory with loaded conversations
        loadedConversations.forEach((msgs, id) => {
          conversationStore.set(id, msgs);
          const firstMessage = msgs.find(msg => msg.role === 'user' || msg.role === 'bot');
          chatHistory.push({
            id: id,
            text: firstMessage?.content || '<<empty>>'
          });
        });

        // Update conversationList with filtered conversations
        conversationList[CHAT_HISTORY_HEADER] = chatHistory;
        setConversations(conversationList);
      }
    } catch (error) {
      console.error('Failed to load conversations from backend:', error);
    }
  }, []);

  const setCurrentConversation = (newConversationId: string | undefined, newMessages: ExtendedMessage[]): void => {
    if (messages.length > 0 && conversationId) {
      conversationStore.set(conversationId, messages);
      // Save conversation to storage
      saveConversation(conversationId, messages);
      // Only update conversation list if this conversation is in backend IDs
      if (backendConversationIds.includes(conversationId)) {
        updateConversationList();
      }
    }
    if (newMessages !== messages) {
      setMessages(newMessages);
    }
    if (newConversationId !== conversationId) {
      setConversationId(newConversationId);
    }
  };

  const onHandleSend = (msg: string | number): void => {
    handleSend(msg, props.context);
  };

  const setDockedSize = useCallback(() => {
    requestAnimationFrame(() => {
      const drawer = document.querySelector('.pf-v6-c-page__drawer') as HTMLElement | null;
      const mainContainer = document.querySelector('.pf-v6-c-page__main-container') as HTMLElement | null;
      const target = drawer ?? mainContainer;

      if (target) {
        const { height, width } = target.getBoundingClientRect();
        document.documentElement.style.setProperty('--kiali-chatbot-docked-height', `${height}px`);
        document.documentElement.style.setProperty('--kiali-chatbot-fullscreen-height', `${height}px`);
        document.documentElement.style.setProperty('--kiali-chatbot-fullscreen-width', `${width}px`);
      }
    });
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

  // Load conversations on mount and when chatbot becomes visible
  useEffect(() => {
    if (chatbotVisible) {
      loadConversationsFromBackend();
    }
  }, [chatbotVisible, loadConversationsFromBackend]);

  // Update conversation list when backend IDs change
  useEffect(() => {
    updateConversationList();
  }, [backendConversationIds, updateConversationList]);

  // Save messages to storage when they change and refresh backend conversation IDs
  useEffect(() => {
    if (conversationId && messages.length > 0) {
      saveConversation(conversationId, messages);
      conversationStore.set(conversationId, messages);
      // Refresh backend conversation IDs to include new conversations
      // This ensures newly created conversations appear in the history
      // The loadConversationsFromBackend will update backendConversationIds,
      // which will trigger the useEffect that calls updateConversationList
      loadConversationsFromBackend();
    }
  }, [conversationId, messages, loadConversationsFromBackend]);

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
  ): void => {
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
            updateConversationList();
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
                updateConversationList();
              }
            }
          }}
          conversations={conversations}
          onNewChat={() => {
            setIsDrawerOpen(!isDrawerOpen);
            setCurrentConversation(undefined, []);
            updateConversationList();
          }}
          handleTextInputChange={(value: string) => {
            if (value === '') {
              updateConversationList();
            } else {
              // this is where you would perform search on the items in the drawer
              // and update the state
              const newConversations: { [key: string]: Conversation[] } = findMatchingItems(value);
              setConversations(newConversations);
            }
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
                providers={props.providers}
                selectedModel={selectedModel}
                selectedProvider={selectedProvider}
                onSelectProvider={onProviderChange}
                onSelectModel={setSelectedModel}
                selectedMockConversation={selectedMockConversation}
                setSelectedMockConversation={handleSelectMockConversation}
              />
              {isMockApi && (
                <ChatBotMock
                  handleSelectMockConversation={handleSelectMockConversation}
                  selectedMockConversation={selectedMockConversation}
                />
              )}
              <ChatBotContent
                username={props.username}
                displayMode={displayMode}
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
  providers: state.chatAi.providers,
  defaultProvider: state.chatAi.defaultProvider
});

export const ChatBot = connect(mapStateToProps)(ChatBotComponent);
