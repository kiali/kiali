import React from 'react';
import { FormSelect, FormSelectOption, FormSelectOptionGroup } from '@patternfly/react-core';
import { conversationEntryIds } from '../../mocks/handlers/chatbot/conversations';

type ChatBotMockProps = {
  handleSelectMockConversation: (conversation: string) => void;
  selectedMockConversation: string;
};

export const ChatBotMock: React.FC<ChatBotMockProps> = ({ handleSelectMockConversation, selectedMockConversation }) => {
  const normalizeConversationId = (conversationId: string): string =>
    conversationId
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const formatConversationLabel = (conversationId: string): string =>
    normalizeConversationId(conversationId).replace(/\b\w/g, char => char.toUpperCase());

  const getConversationGroup = (conversationId: string): string => {
    const words = normalizeConversationId(conversationId).split(' ').filter(Boolean);
    if (!words.length) {
      return 'Other';
    }
    const groupWords = words[0].toLowerCase() === 'action' && words.length > 1 ? words.slice(0, 2) : words.slice(0, 1);
    return groupWords.join(' ');
  };

  const conversationGroups = conversationEntryIds.reduce((groups, conversationId) => {
    const groupKey = getConversationGroup(conversationId);
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)?.push(conversationId);
    return groups;
  }, new Map<string, string[]>());

  return (
    <FormSelect
      value={selectedMockConversation}
      onChange={(_event, value) => handleSelectMockConversation(value)}
      aria-label="Select mock conversation"
      width="100%"
    >
      <FormSelectOption
        isPlaceholder={true}
        key="mainSelectorMockConversation"
        value="Select one Mock Conversation"
        label="Select one Mock Conversation"
      />
      {Array.from(conversationGroups.entries()).map(([groupKey, conversationIds]) => (
        <FormSelectOptionGroup key={groupKey} label={formatConversationLabel(groupKey)}>
          {conversationIds.map(conversationId => (
            <FormSelectOption
              key={conversationId}
              value={conversationId}
              label={formatConversationLabel(conversationId)}
            />
          ))}
        </FormSelectOptionGroup>
      ))}
    </FormSelect>
  );
};
