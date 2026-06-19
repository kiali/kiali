import React from 'react';
import {
  Button,
  ButtonVariant,
  Divider,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  Tooltip
} from '@patternfly/react-core';
import {
  ChatbotDisplayMode,
  ChatbotHeader,
  ChatbotHeaderActions,
  ChatbotHeaderMain,
  ChatbotHeaderSelectorDropdown
} from '@patternfly/chatbot';
import { OpenDrawerRightIcon, OutlinedWindowRestoreIcon, TrashIcon, WindowMinimizeIcon } from '@patternfly/react-icons';
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

  const setDisplayMode = (mode: ChatbotDisplayMode): void => {
    dispatch(ChatAIActions.setDisplayMode({ displayMode: mode }));
  };

  return (
    <ChatbotHeader>
      <ChatbotHeaderMain>
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
      </ChatbotHeaderMain>
      <ChatbotHeaderActions>
        <Tooltip content={t('New chat')}>
          <Button
            aria-label={t('New chat')}
            variant={ButtonVariant.plain}
            size="sm"
            icon={<TrashIcon />}
            onClick={onNewChat}
          />
        </Tooltip>
        {displayMode !== ChatbotDisplayMode.default && (
          <Tooltip content={t('Overlay')}>
            <Button
              aria-label={t('Overlay')}
              variant={ButtonVariant.plain}
              size="sm"
              icon={<OutlinedWindowRestoreIcon />}
              onClick={() => setDisplayMode(ChatbotDisplayMode.default)}
              data-test="chatbot-display-overlay"
            />
          </Tooltip>
        )}
        {displayMode !== ChatbotDisplayMode.docked && (
          <Tooltip content={t('Dock to window')}>
            <Button
              aria-label={t('Dock to window')}
              variant={ButtonVariant.plain}
              size="sm"
              icon={<OpenDrawerRightIcon />}
              onClick={() => setDisplayMode(ChatbotDisplayMode.docked)}
              data-test="chatbot-display-dock"
            />
          </Tooltip>
        )}
        <Tooltip content={t('Minimize')}>
          <Button
            aria-label={t('Minimize')}
            variant={ButtonVariant.plain}
            size="sm"
            icon={<WindowMinimizeIcon />}
            onClick={onCloseChat}
            data-test="chatbot-minimize"
          />
        </Tooltip>
      </ChatbotHeaderActions>
    </ChatbotHeader>
  );
};
