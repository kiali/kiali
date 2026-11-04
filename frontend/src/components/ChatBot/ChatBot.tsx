import React, { useEffect, useState } from 'react';
import { t } from 'utils/I18nUtils';
import { Chatbot, ChatbotDisplayMode, ChatbotToggle } from '@patternfly/chatbot';
import { Drawer, DrawerContent, DrawerContentBody, DrawerPanelContent } from '@patternfly/react-core';
import '@patternfly/chatbot/dist/css/main.css';
import { ColorScheme } from 'types/Common';
import { useKialiColorScheme } from 'utils/AppearanceUtils';
import { ChatBotHeader } from './ChatBotHeader';
import { ChatBotFooter } from './ChatBotFooter';
import { ChatBotMock } from './ChatBotMock';
import { ChatBotContent } from './ChatBotContent';
import { ReactComponent as KialiIconLight } from '../../assets/img/kiali/icon-lightbkg.svg';
import { ReactComponent as KialiIconDark } from '../../assets/img/kiali/icon-darkbkg.svg';
import { defer } from 'lodash-es';
import { ChatAIActions } from 'actions/ChatAIActions';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import * as API from 'services/Api';
import { kialiStyle } from 'styles/StyleUtils';

const chatDrawerStyle = kialiStyle({
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  minWidth: 0
});

// The graph page grows with flex. This body has to be a column flex container so that
// growth reaches the canvas; overflow stays here so taller pages can still scroll.
const drawerBodyStyle = kialiStyle({
  display: 'flex',
  flex: '1 1 auto',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  overflow: 'auto'
});

const panelFillStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
  minWidth: 0,
  // The chatbot paints the page background, which hides the docked panel in the
  // page's top and bottom inset. Let the panel surface show through instead.
  $nest: {
    '& .pf-chatbot, & .pf-chatbot__content, & .pf-chatbot__footer': {
      backgroundColor: 'var(--pf-t--global--background--color--primary--default)'
    }
  }
});

// Drawer display mode is still position:fixed in the chatbot stylesheet. Fill the resizable panel instead.
const drawerChatStyle = kialiStyle({
  height: '100%',
  inset: 'auto',
  maxHeight: '100%',
  position: 'relative',
  width: '100%',
  zIndex: 'auto'
});

type ChatBotProps = {
  children: React.ReactNode;
};

const PANEL_BASIS = '--pf-v6-c-drawer__panel--md--FlexBasis';
const DOCK_TOP = '--kiali-chatbot-dock-top';
const DOCK_INLINE_END = '--kiali-chatbot-dock-inline-end';
const PANEL_WIDTH = '--kiali-chatbot-panel-width';

// The page card is inset from the viewport. Measure the gap between the card content
// and the window so the chat can cover that space without moving the page content.
const syncDockInsets = (): void => {
  const masthead = document.querySelector('.pf-v6-c-masthead');
  const section = document.querySelector('.pf-v6-c-page__main-section');
  const top = masthead?.getBoundingClientRect().bottom ?? 0;
  let inlineEnd = 0;

  if (section) {
    const paddingRight = parseFloat(getComputedStyle(section).paddingRight) || 0;
    inlineEnd = window.innerWidth - section.getBoundingClientRect().right + paddingRight;
  }

  document.documentElement.style.setProperty(DOCK_TOP, `${top}px`);
  document.documentElement.style.setProperty(DOCK_INLINE_END, `${Math.max(inlineEnd, 0)}px`);
};

export const ChatBot: React.FC<ChatBotProps> = ({ children }) => {
  const dispatch = useKialiDispatch();
  const colorScheme = useKialiColorScheme();
  const isDarkTheme = colorScheme === ColorScheme.DARK;
  const ClosedToggleIcon = isDarkTheme ? KialiIconDark : KialiIconLight;
  const allowedToUseChatbot = useKialiSelector(state => state.ai.chat.allowed);
  const chatbotVisible = useKialiSelector(state => state.ai.chat.visible);
  const expanded = chatbotVisible && allowedToUseChatbot;
  const selectedProvider = useKialiSelector(state => state.ai.chat.selectedProvider);
  const selectedModel = useKialiSelector(state => state.ai.chat.selectedModel);
  const providers = useKialiSelector(state => state.ai.chat.providers);
  const conversationID = useKialiSelector(state => state.ai.chat.conversationID);
  const chatHistory = useKialiSelector(state => state.ai.chat.chatHistory);
  const [newProvider, setNewProvider] = useState<string>('');
  const [newModel, setNewModel] = useState<string>('');
  // Includes the dock inset. PatternFly measures this rendered width while dragging.
  const [panelSize, setPanelSize] = useState(`calc(30rem + var(${DOCK_INLINE_END}, 0px))`);
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
      if (conversationID === '' && chatHistory.size === 0) {
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
    if (conversationID !== '') {
      // Fire-and-forget: the result is irrelevant because the UI has already
      // moved to a fresh conversation and there is nowhere to surface the error.
      API.deleteChatConversations(conversationID).catch(() => {});
    }
    dispatch(ChatAIActions.setConversationID({ id: undefined }));
    dispatch(ChatAIActions.setChatHistoryClear());
  }, [dispatch, conversationID]);

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
    if (!expanded) {
      return undefined;
    }

    syncDockInsets();
    const onResize = (): void => syncDockInsets();
    window.addEventListener('resize', onResize);

    const panel = document.querySelector<HTMLElement>('[data-test="ai-chatbot-drawer"]');
    const publishWidth = (): void => {
      const basis = panel?.style.getPropertyValue(PANEL_BASIS).trim() || panelSize;
      document.documentElement.style.setProperty(PANEL_WIDTH, basis);
    };
    publishWidth();

    const observer = panel ? new MutationObserver(publishWidth) : undefined;
    observer?.observe(panel as HTMLElement, { attributeFilter: ['style'], attributes: true });

    return () => {
      window.removeEventListener('resize', onResize);
      observer?.disconnect();
    };
  }, [expanded, panelSize]);

  return (
    <div className={chatDrawerStyle}>
      <Drawer isExpanded={expanded} isInline position="end">
        <DrawerContent
          panelContent={
            <DrawerPanelContent
              data-test="ai-chatbot-drawer"
              defaultSize="30rem"
              isResizable
              maxSize="60%"
              minSize="20rem"
              onResize={(_event, width) => {
                const size = `${width}px`;
                setPanelSize(size);
                document.documentElement.style.setProperty(PANEL_WIDTH, size);
              }}
              resizeAriaLabel={t('Resize')}
              style={
                expanded
                  ? ({
                      [PANEL_BASIS]: panelSize,
                      '--pf-v6-c-drawer__panel--PaddingBlockEnd': 0,
                      '--pf-v6-c-drawer__panel--PaddingBlockStart': 0,
                      borderRadius: 0,
                      bottom: 0,
                      height: 'auto',
                      insetInlineEnd: 0,
                      maxHeight: 'none',
                      position: 'fixed',
                      top: `var(${DOCK_TOP}, 0px)`,
                      transform: 'none',
                      width: `var(${PANEL_BASIS}, ${panelSize})`,
                      zIndex: 250
                    } as React.CSSProperties)
                  : undefined
              }
            >
              <div className={panelFillStyle}>
                {expanded && (
                  <Chatbot className={drawerChatStyle} displayMode={ChatbotDisplayMode.drawer} isVisible>
                    <ChatBotHeader
                      onCloseChat={() => dispatch(ChatAIActions.setChatVisible(false))}
                      onNewChat={() => setIsNewChatModalOpen(true)}
                    />
                    {isMockApi && (
                      <ChatBotMock
                        handleSelectMockConversation={handleSelectMockConversation}
                        selectedMockConversation={selectedMockConversation}
                      />
                    )}
                    <ChatBotContent chatHistoryEndRef={chatHistoryEndRef} />
                    <ChatBotFooter
                      isNewChatModalOpen={isNewChatModalOpen}
                      onConfirm={onConfirm}
                      onSelectProviderModel={onSelectProviderModel}
                      providerChanged={newProvider !== '' || newModel !== ''}
                      scrollIntoView={scrollIntoView}
                      setIsNewChatModalOpen={setIsNewChatModalOpen}
                    />
                  </Chatbot>
                )}
              </div>
            </DrawerPanelContent>
          }
        >
          <DrawerContentBody
            className={drawerBodyStyle}
            style={
              expanded
                ? { marginInlineEnd: `calc(var(${PANEL_WIDTH}, ${panelSize}) - var(${DOCK_INLINE_END}, 0px))` }
                : undefined
            }
          >
            {children}
          </DrawerContentBody>
        </DrawerContent>
      </Drawer>
      <div
        style={{
          position: 'fixed',
          bottom: '20px',
          right: expanded ? `calc(var(${PANEL_WIDTH}, ${panelSize}) + 1.25rem)` : '20px',
          zIndex: 1000
        }}
      >
        <ChatbotToggle
          tooltipLabel={
            allowedToUseChatbot
              ? expanded
                ? t('Minimize')
                : t('Chat with AI')
              : t('Chatbot is not allowed for this user')
          }
          isChatbotVisible={expanded}
          onToggleChatbot={() => allowedToUseChatbot && dispatch(ChatAIActions.setChatVisible(!chatbotVisible))}
          isRound={true}
          closedToggleIcon={() => (
            <span data-test={isDarkTheme ? 'ai-chatbot-toggle-icon-dark' : 'ai-chatbot-toggle-icon-light'}>
              <ClosedToggleIcon style={{ height: '2.5rem', width: '2.5rem' }} />
            </span>
          )}
          style={chatbotToggleStyle}
          data-test="ai-chatbot-toggle"
        />
      </div>
    </div>
  );
};
