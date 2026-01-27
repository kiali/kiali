import React from 'react';
import {
  Brand,
  Bullseye,
  DropdownGroup,
  DropdownItem,
  DropdownList,
  FormSelect,
  FormSelectOption,
  FormSelectOptionGroup,
  Tooltip
} from '@patternfly/react-core';
import {
  ChatbotDisplayMode,
  ChatbotHeader,
  ChatbotHeaderActions,
  ChatbotHeaderMain,
  ChatbotHeaderMenu,
  ChatbotHeaderOptionsDropdown,
  ChatbotHeaderTitle
} from '@patternfly/chatbot';
import { ExpandIcon, OpenDrawerRightIcon, OutlinedWindowRestoreIcon, TimesIcon } from '@patternfly/react-icons';
import KialiHorizontalLogoColor from '../../assets/img/kiali/logo-lightbkg.svg';
import KialiHorizontalLogoReverse from '../../assets/img/kiali/logo-darkbkg.svg';
import KialiconLogoColor from '../../assets/img/kiali/icon-lightbkg.svg';
import KialiIconLogoDark from '../../assets/img/kiali/icon-darkbkg.svg';
import { ModelAI, ProviderAI } from 'types/Chatbot';

type ChatBotHeaderProps = {
  displayMode: ChatbotDisplayMode;
  historyRef: React.RefObject<HTMLButtonElement>;
  isDrawerOpen: boolean;
  onCloseChat: () => void;
  onSelectDisplayMode: (
    _event: React.MouseEvent<Element, MouseEvent> | undefined,
    value: string | number | undefined
  ) => void;
  onSelectModel: (model: ModelAI) => void;
  onSelectProvider: (provider: ProviderAI) => void;
  onToggleDrawer: () => void;
  providers: ProviderAI[];
  selectedMockConversation?: string;
  selectedModel: ModelAI;
  selectedProvider: ProviderAI;
  setSelectedMockConversation?: (conversation: string) => void;
};

export const ChatBotHeader: React.FC<ChatBotHeaderProps> = ({
  displayMode,
  isDrawerOpen,
  onToggleDrawer,
  onSelectDisplayMode,
  onCloseChat,
  historyRef,
  providers,
  selectedProvider,
  selectedModel,
  onSelectProvider,
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

  const onSelectProviderModel = (_event: React.FormEvent<HTMLSelectElement>, value: string): void => {
    const [providerName, modelName] = value.split(':');
    const provider = providers.find(candidate => candidate.name === providerName);
    if (!provider) {
      return;
    }
    const model = provider.models.find(candidate => candidate.name === modelName) ?? provider.models[0];
    if (!model) {
      return;
    }
    onSelectProvider(provider);
    onSelectModel(model);
  };

  const generateContentTooltip = (provider: ProviderAI, model: ModelAI): React.ReactElement => {
    return (
      <div>
        <div>
          Provider: {provider.name} ({provider.description})
        </div>
        <div>
          Model: {model.name} ({model.description})
        </div>
      </div>
    );
  };

  if (!selectedProvider || !selectedModel) {
    return null;
  }

  return (
    <ChatbotHeader>
      <ChatbotHeaderMain>
        <ChatbotHeaderMenu ref={historyRef} aria-expanded={isDrawerOpen} onMenuToggle={onToggleDrawer} />
        <ChatbotHeaderTitle displayMode={displayMode} showOnFullScreen={horizontalLogo} showOnDefault={iconLogo} />
      </ChatbotHeaderMain>
      <ChatbotHeaderActions>
        <Tooltip content={generateContentTooltip(selectedProvider, selectedModel)}>
          <FormSelect
            id={`provider-model-select`}
            value={`${selectedProvider.name}:${selectedModel.name}`}
            onChange={onSelectProviderModel}
          >
            {providers.map(provider => (
              <FormSelectOptionGroup key={provider.name} label={`Provider: ${provider.name}`}>
                {provider.models.map(model => (
                  <FormSelectOption
                    key={model.name}
                    value={`${provider.name}:${model.name}`}
                    label={`${provider.name}:${model.name}`}
                  />
                ))}
              </FormSelectOptionGroup>
            ))}
          </FormSelect>
        </Tooltip>
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
