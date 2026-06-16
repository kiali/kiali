import React from 'react';
import { Divider, DropdownGroup, DropdownItem, DropdownList } from '@patternfly/react-core';
import {
  ChatbotDisplayMode,
  ChatbotHeader,
  ChatbotHeaderActions,
  ChatbotHeaderMain,
  ChatbotHeaderOptionsDropdown,
  ChatbotHeaderNewChatButton,
  ChatbotHeaderSelectorDropdown
} from '@patternfly/chatbot';
import {
  EllipsisVIcon,
  ExpandIcon,
  OpenDrawerRightIcon,
  OutlinedWindowRestoreIcon,
  WindowMinimizeIcon
} from '@patternfly/react-icons';
import { t } from 'utils/I18nUtils';
import { useDispatch, useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { ChatAIActions } from 'actions/ChatAIActions';

type ChatBotHeaderProps = {
  onCloseChat: () => void;
  onNewChat: () => void;
  onSelectProviderModel: (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => void;
};

export const ChatBotHeader: React.FC<ChatBotHeaderProps> = ({ onCloseChat, onSelectProviderModel, onNewChat }) => {
  const selectedProvider = useSelector((state: KialiAppState) => state.aiChat.selectedProvider);
  const selectedModel = useSelector((state: KialiAppState) => state.aiChat.selectedModel);
  const displayMode = useSelector((state: KialiAppState) => state.aiChat.displayMode);
  const providers = useSelector((state: KialiAppState) => state.aiChat.providers);
  const dispatch = useDispatch();

  if (!selectedProvider || !selectedModel) {
    return null;
  }

  const onSelectDisplayMode = (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ): void => {
    if (typeof value !== 'string') {
      return;
    }
    dispatch(ChatAIActions.setDisplayMode({ displayMode: value as ChatbotDisplayMode }));
  };

  return (
    <ChatbotHeader>
      <ChatbotHeaderMain>
        <ChatbotHeaderNewChatButton onClick={onNewChat} isCompact />
      </ChatbotHeaderMain>
      <ChatbotHeaderActions>
        <ChatbotHeaderSelectorDropdown
          value={`${selectedProvider}:${selectedModel}`}
          onSelect={onSelectProviderModel}
          isCompact
        >
          {providers.map((provider, i) => (
            <>
              <DropdownGroup label={`${provider.name}`} labelHeadingLevel="h3">
                <DropdownList>
                  {provider.models.map(model => (
                    <DropdownItem key={`${provider.name}:${model.name}`} value={`${provider.name}:${model.name}`}>
                      {`${model.name}`}
                    </DropdownItem>
                  ))}
                </DropdownList>
              </DropdownGroup>
              {i < providers.length - 1 && <Divider key={`divider_${i}`} />}
            </>
          ))}
        </ChatbotHeaderSelectorDropdown>
        <ChatbotHeaderOptionsDropdown
          onSelect={onSelectDisplayMode}
          isCompact
          toggleProps={{ icon: <EllipsisVIcon /> }}
        >
          <DropdownGroup label={t('Display Mode')}>
            <DropdownList>
              <DropdownItem
                value={ChatbotDisplayMode.default}
                key="switchDisplayOverlay"
                icon={<OutlinedWindowRestoreIcon aria-hidden />}
                isSelected={displayMode === ChatbotDisplayMode.default}
              >
                <span>{t('Overlay')}</span>
              </DropdownItem>
              <DropdownItem
                value={ChatbotDisplayMode.docked}
                key="switchDisplayDock"
                icon={<OpenDrawerRightIcon aria-hidden />}
                isSelected={displayMode === ChatbotDisplayMode.docked}
              >
                <span>{t('Dock to window')}</span>
              </DropdownItem>
              <DropdownItem
                value={ChatbotDisplayMode.fullscreen}
                key="switchDisplayFullscreen"
                icon={<ExpandIcon aria-hidden />}
                isSelected={displayMode === ChatbotDisplayMode.fullscreen}
              >
                <span>{t('Fullscreen')}</span>
              </DropdownItem>
              <DropdownItem key="scloseChat" icon={<WindowMinimizeIcon aria-hidden />} onClick={onCloseChat}>
                <span>{t('Minimize')}</span>
              </DropdownItem>
            </DropdownList>
          </DropdownGroup>
        </ChatbotHeaderOptionsDropdown>
      </ChatbotHeaderActions>
    </ChatbotHeader>
  );
};
