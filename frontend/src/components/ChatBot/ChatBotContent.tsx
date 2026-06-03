import React from 'react';
import { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { ChatbotContent, MessageBox } from '@patternfly/chatbot';
import { useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { EntryChat } from './EntryChat/EntryChat';

type ChatBotContentProps = {
  chatHistoryEndRef: React.RefObject<HTMLDivElement>;
};

export const ChatBotContent: React.FC<ChatBotContentProps> = ({ chatHistoryEndRef }) => {
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector(
    (s: KialiAppState) => s.aiChat.chatHistory
  );

  return (
    <ChatbotContent>
      <MessageBox>
        {chatHistory.map((entry, i) => (
          <EntryChat entryIndex={i} key={(entry.get('id') as string) ?? i} />
        ))}
        <div ref={chatHistoryEndRef} />
      </MessageBox>
    </ChatbotContent>
  );
};
