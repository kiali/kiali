import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { t } from 'utils/I18nUtils';
import { Chatbot, ChatbotToggle, Conversation } from '@patternfly/chatbot';
import '@patternfly/chatbot/dist/css/main.css';
import { Theme } from 'types/Common';
import { useKialiTheme } from 'utils/ThemeUtils';
import { ChatBotHeader } from './ChatBotHeader';
import { KialiAppState } from 'store/Store';
import { ChatBotFooter } from './ChatBotFooter';
import { ChatBotMock } from './ChatBotMock';
import { ExtendedMessage } from 'types/Chatbot';
import { ChatBotContent } from './ChatBotContent';
import { CHAT_HISTORY_HEADER } from 'config/Constants';
import { ReactComponent as KialiIconLight } from '../../assets/img/kiali/icon-lightbkg.svg';
import { ReactComponent as KialiIconDark } from '../../assets/img/kiali/icon-darkbkg.svg';
import { defer } from 'lodash-es';
import { ChatAIActions } from 'actions/ChatAIActions';

const conversationList: { [key: string]: Conversation[] } = {};
conversationList[CHAT_HISTORY_HEADER] = [];

export const conversationStore: Map<string, ExtendedMessage[]> = new Map();

const resetConversationState = (): void => {
  conversationList[CHAT_HISTORY_HEADER] = [];
  conversationStore.clear();
};

export const ChatBot: React.FC = () => {
  const dispatch = useDispatch();
  const theme = useKialiTheme();
  const isDarkTheme = theme === Theme.DARK;
  const ClosedToggleIcon = isDarkTheme ? KialiIconDark : KialiIconLight;
  const displayMode = useSelector((state: KialiAppState) => state.aiChat.displayMode);
  const selectedProvider = useSelector((state: KialiAppState) => state.aiChat.selectedProvider);
  const selectedModel = useSelector((state: KialiAppState) => state.aiChat.selectedModel);
  const providers = useSelector((state: KialiAppState) => state.aiChat.providers);
  const conversationID = useSelector((state: KialiAppState) => state.aiChat.conversationID);
  const [newProvider, setNewProvider] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  const [chatbotVisible, setChatbotVisible] = useState<boolean>(false);
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
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState<boolean>(false);
  const chatHistoryEndRef = React.useRef<HTMLDivElement | null>(null);
  const scrollIntoView = React.useCallback((behavior = 'smooth') => {
    defer(() => {
      chatHistoryEndRef?.current?.scrollIntoView({ behavior });
    });
  }, []);

  const handleSelectMockConversation = (conversation: string): void => {
    if (conversation === 'Select one Mock Conversation') {
      return;
    }
    setSelectedMockConversation(conversation);
    // handleSend(conversation);
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

  const onSelectProviderModel = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ): void => {
    if (typeof value !== 'string') {
      return;
    }
    const [providerName, modelName] = value.split(':');
    const provider = providers.find(candidate => candidate.name === providerName);
    if (!provider) {
      return;
    }
    const model = provider.models.find(candidate => candidate.name === modelName) ?? provider.models[0];
    if (!model) {
      return;
    }
    if (provider.name !== selectedProvider || model.name !== selectedModel) {
      if (conversationID === '') {
        dispatch(ChatAIActions.setSelectedProvider({ provider: provider.name }));
        dispatch(ChatAIActions.setSelectedModel({ model: model.name }));
      } else {
        setNewProvider(provider.name);
        setNewModel(model.name);
        setIsNewChatModalOpen(true);
      }
    }
  };

  const clearChat = React.useCallback(() => {
    dispatch(ChatAIActions.setConversationID({ id: undefined }));
    dispatch(ChatAIActions.setChatHistoryClear());
  }, [dispatch]);

  const onConfirm = React.useCallback(() => {
    if (newProvider !== '') {
      dispatch(ChatAIActions.setSelectedProvider({ provider: newProvider }));
    }
    if (newModel !== '') {
      dispatch(ChatAIActions.setSelectedModel({ model: newModel }));
    }
    setNewProvider('');
    setNewModel('');
    clearChat();
    setIsNewChatModalOpen(false);
  }, [clearChat, newProvider, newModel, dispatch, setIsNewChatModalOpen]);

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
  }, [setDockedSize, displayMode, chatbotVisible]);

  useEffect(
    () =>
      // Fired on component mount (componentDidMount)
      () => {
        // Anything in here is fired on component unmount (componentWillUnmount)
        resetConversationState();
      },
    []
  );

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
        closedToggleIcon={() => (
          <span data-test={isDarkTheme ? 'ai-chatbot-toggle-icon-dark' : 'ai-chatbot-toggle-icon-light'}>
            <ClosedToggleIcon style={{ height: '2.5rem', width: '2.5rem' }} />
          </span>
        )}
        style={chatbotToggleStyle}
        data-test="ai-chatbot-toggle"
      />
      <Chatbot isVisible={chatbotVisible} displayMode={displayMode}>
        <ChatBotHeader
          onCloseChat={() => setChatbotVisible(!chatbotVisible)}
          onNewChat={() => setIsNewChatModalOpen(true)}
          onSelectProviderModel={onSelectProviderModel}
        />
        {isMockApi && (
          <ChatBotMock
            handleSelectMockConversation={handleSelectMockConversation}
            selectedMockConversation={selectedMockConversation}
          />
        )}
        <ChatBotContent chatHistoryEndRef={chatHistoryEndRef} />
        <ChatBotFooter
          providerChanged={newProvider !== '' || newModel !== ''}
          onConfirm={onConfirm}
          scrollIntoView={scrollIntoView}
          isNewChatModalOpen={isNewChatModalOpen}
          setIsNewChatModalOpen={setIsNewChatModalOpen}
        />
      </Chatbot>
    </div>
  );
};
