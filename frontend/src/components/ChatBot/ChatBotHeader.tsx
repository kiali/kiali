import React from 'react';
import { Brand, Bullseye, DropdownGroup, DropdownItem, DropdownList } from '@patternfly/react-core';
import {
  ChatbotDisplayMode,
  ChatbotHeader,
  ChatbotHeaderActions,
  ChatbotHeaderMain,
  ChatbotHeaderMenu,
  ChatbotHeaderOptionsDropdown,
  ChatbotHeaderSelectorDropdown,
  ChatbotHeaderTitle
} from '@patternfly/chatbot';
import { ExpandIcon, OpenDrawerRightIcon, OutlinedWindowRestoreIcon, TimesIcon } from '@patternfly/react-icons';
import KialiHorizontalLogoColor from '../../assets/img/kiali/logo-lightbkg.svg';
import KialiHorizontalLogoReverse from '../../assets/img/kiali/logo-darkbkg.svg';
import KialiconLogoColor from '../../assets/img/kiali/icon-lightbkg.svg';
import KialiIconLogoDark from '../../assets/img/kiali/icon-darkbkg.svg';
import { ModelAI } from 'types/Chatbot';

type ChatBotHeaderProps = {
  displayMode: ChatbotDisplayMode;
  isDrawerOpen: boolean;
  onToggleDrawer: () => void;
  onSelectDisplayMode: (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => void;
  onCloseChat: () => void;
  historyRef: React.RefObject<HTMLButtonElement>;
  models: ModelAI[];
  selectedModel: ModelAI;
  onSelectModel: (model: ModelAI) => void;
};

export const ChatBotHeader: React.FC<ChatBotHeaderProps> = ({
  displayMode,
  isDrawerOpen,
  onToggleDrawer,
  onSelectDisplayMode,
  onCloseChat,
  historyRef,
  models,
  selectedModel,
  onSelectModel
}) => {
  const horizontalLogo = (
    <Bullseye>
      <Brand className="show-light" src={KialiHorizontalLogoColor} alt="Kiali" />
      <Brand className="show-dark" src={KialiHorizontalLogoReverse} alt="Kiali" />
    </Bullseye>
  );

  const iconLogo = (
    <>
      <Brand className="show-light" src={KialiconLogoColor} alt="Kiali" />
      <Brand className="show-dark" src={KialiIconLogoDark} alt="Kiali" />
    </>
  );

  const generateContentTooltip = (model: ModelAI) => {
    if (model.description) {
      return `Model: ${model.model} (${model.description})`;
    }
    return `Model: ${model.model}`;
  };
  return (
    <ChatbotHeader>
      <ChatbotHeaderMain>
        <ChatbotHeaderMenu ref={historyRef} aria-expanded={isDrawerOpen} onMenuToggle={onToggleDrawer} />
        <ChatbotHeaderTitle displayMode={displayMode} showOnFullScreen={horizontalLogo} showOnDefault={iconLogo} />
      </ChatbotHeaderMain>
      <ChatbotHeaderActions>
        <ChatbotHeaderSelectorDropdown
          tooltipContent={generateContentTooltip(selectedModel)}
          value={selectedModel.name}
          onSelect={(_, value) => onSelectModel(models.filter(model => model.name === value)[0])}
        >
          <DropdownList>
            {models.map(model => (
              <DropdownItem value={model.name} key={model.name}>
                {model.name}
              </DropdownItem>
            ))}
          </DropdownList>
        </ChatbotHeaderSelectorDropdown>
        <ChatbotHeaderOptionsDropdown onSelect={onSelectDisplayMode}>
          <DropdownGroup label="Display Mode">
            <DropdownList>
              <DropdownItem
                value={ChatbotDisplayMode.default}
                key="switchDisplayOverlay"
                icon={<OutlinedWindowRestoreIcon aria-hidden />}
                isSelected={displayMode === ChatbotDisplayMode.default}
              >
                <span>Overlay</span>
              </DropdownItem>
              <DropdownItem
                value={ChatbotDisplayMode.docked}
                key="switchDisplayDock"
                icon={<OpenDrawerRightIcon aria-hidden />}
                isSelected={displayMode === ChatbotDisplayMode.docked}
              >
                <span>Dock to window</span>
              </DropdownItem>
              <DropdownItem
                value={ChatbotDisplayMode.fullscreen}
                key="switchDisplayFullscreen"
                icon={<ExpandIcon aria-hidden />}
                isSelected={displayMode === ChatbotDisplayMode.fullscreen}
              >
                <span>Fullscreen</span>
              </DropdownItem>
              <DropdownItem key="scloseChat" icon={<TimesIcon aria-hidden />} onClick={onCloseChat}>
                <span>Close Chat</span>
              </DropdownItem>
            </DropdownList>
          </DropdownGroup>
        </ChatbotHeaderOptionsDropdown>
      </ChatbotHeaderActions>
    </ChatbotHeader>
  );
};
