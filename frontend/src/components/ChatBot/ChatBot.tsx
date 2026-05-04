import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'utils/I18nUtils';
import { ChatAIActions } from 'actions/ChatAIActions';
import {
  Chatbot,
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
import { ReactComponent as KialiIconLight } from '../../assets/img/kiali/icon-lightbkg.svg';
import { ReactComponent as KialiIconDark } from '../../assets/img/kiali/icon-darkbkg.svg';
import { saveConversation } from 'utils/ConversationStorage';

type ReduxStateProps = {
  context: ContextRequest;
  defaultProvider: string;
  providers: ProviderAI[];
  username: string;
  conversationID: string;
};

type ChatBotProps = ReduxStateProps;

const conversationList: { [key: string]: Conversation[] } = {};
conversationList[CHAT_HISTORY_HEADER] = [];

export const conversationStore: Map<string, ExtendedMessage[]> = new Map();

const resetConversationState = (): void => {
  conversationList[CHAT_HISTORY_HEADER] = [];
  conversationStore.clear();
};

export const ChatBotComponent: React.FC<ChatBotProps> = (props: ChatBotProps) => {
  const defaultProvider = props.providers.filter(provider => provider.name === props.defaultProvider)[0];
  const defaultModel = defaultProvider.models.filter(model => model.name === defaultProvider.defaultModel)[0];
  const {
    addBotMessage,
    handleSend,
    alertMessage,
    botMessage,
    selectedModel,
    setSelectedModel,
    selectedProvider,
    setSelectedProvider,
    messages,
    isLoading,
    setAlertMessage,
    setMessages
  } = useChatbot(props.username, defaultProvider, defaultModel);

  const dispatch = useDispatch();
  const theme = useKialiTheme();
  const isDarkTheme = theme === Theme.DARK;
  const ClosedToggleIcon = isDarkTheme ? KialiIconDark : KialiIconLight;

  const [chatbotVisible, setChatbotVisible] = useState<boolean>(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [displayMode, setDisplayMode] = useState<ChatbotDisplayMode>(ChatbotDisplayMode.default);
  const toggleBg = isDarkTheme ? 'var(--pf-t--color--gray--90)' : 'var(--pf-t--color--white)';
  const toggleBorder = isDarkTheme ? 'var(--pf-t--color--white)' : 'var(--pf-t--color--gray--90)';

  const chatbotToggleStyle = {
    borderRadius: '50%',
    width: '3rem',
    height: '3rem',
    background: toggleBg,
    backgroundColor: toggleBg,
    border: `1px solid ${toggleBorder}`
  } as React.CSSProperties;
  // Mock API
  const isMockApi = process.env.REACT_APP_MOCK_API === 'true';
  const [selectedMockConversation, setSelectedMockConversation] = useState<string>('Select one Mock Conversation');

  const handleSelectMockConversation = (conversation: string): void => {
    if (conversation === 'Select one Mock Conversation') {
      return;
    }
    setSelectedMockConversation(conversation);
    handleSend(conversation);
  };
 

  const onProviderChange = (provider: ProviderAI): void => {
    if (provider === selectedProvider) {
      return;
    }
    setSelectedProvider(provider);
    setIsDrawerOpen(false);
    setCurrentConversation(undefined, []);
  };

  const setCurrentConversation = (newConversationId: string | undefined, newMessages: ExtendedMessage[]): void => {
    if (messages.length > 0 && props.conversationID) {
      conversationStore.set(props.conversationID, messages);
      // Save conversation to storage
      saveConversation(props.conversationID, messages);
      // Only update conversation list if this conversation is in backend IDs
        }
    if (newMessages !== messages) {
      setMessages(newMessages);
    }
    if (newConversationId !== props.conversationID) {
      dispatch(ChatAIActions.setConversationID({ id: newConversationId ?? '' }));
    }
  };

  const onHandleSend = (msg: string | number): void => {
    handleSend(msg);
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

  // Save messages to storage when they change and refresh backend conversation IDs
  useEffect(() => {
    if (props.conversationID && messages.length > 0) {
      saveConversation(props.conversationID, messages);
      conversationStore.set(props.conversationID, messages);  
    }
  }, [props.conversationID, messages]);

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
        onToggleChatbot={() => setChatbotVisible(prev => !prev)}
        isRound={true}
        closedToggleIcon={() => <ClosedToggleIcon style={{ height: '2.5rem', width: '2.5rem' }} />}
        style={chatbotToggleStyle}
        data-test="ai-chatbot-toggle"
      />
      <Chatbot isVisible={chatbotVisible} displayMode={displayMode}>
          <ChatBotHeader
                displayMode={displayMode}
                onSelectDisplayMode={onSelectDisplayMode}
                onCloseChat={() => setChatbotVisible(!chatbotVisible)}
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
            addBotMessage={addBotMessage}
            username={props.username}
            displayMode={displayMode}
            alertMessage={alertMessage}
            handleSend={handleSend}
            setAlertMessage={setAlertMessage}
            messages={messages}
            isLoading={isLoading}
            botMessage={botMessage}
          />
          <ChatBotFooter setAlertMessage={() => setAlertMessage(undefined)} handleSend={onHandleSend} />       
      </Chatbot>
    </div>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  username: state.authentication.session?.username ?? '',
  context: state.aiChat.context,
  providers: state.aiChat.providers,
  defaultProvider: state.aiChat.defaultProvider,
  conversationID: state.aiChat.conversationID
});

export const ChatBot = connect(mapStateToProps)(ChatBotComponent);
