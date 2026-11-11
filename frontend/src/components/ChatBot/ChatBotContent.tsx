import React from 'react';
import type { Map as ImmutableMap, List as ImmutableList } from 'immutable';
import { ChatbotContent, MessageBox } from '@patternfly/chatbot';
import { Card, CardBody, CardHeader, CardTitle } from '@patternfly/react-core';
import { useDispatch, useSelector } from 'react-redux';
import type { KialiAppState } from 'store/Store';
import { EntryChat } from './EntryChat/EntryChat';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { t } from 'utils/I18nUtils';
import { ChatAIActions } from 'actions/ChatAIActions';

type ChatBotContentProps = {
  chatHistoryEndRef: React.RefObject<HTMLDivElement>;
};

type StarterPrompt = {
  id: string;
  message: string;
  onClick: () => void;
  title: string;
};

const starterPromptsStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.lg,
  paddingBlockEnd: PFSpacer.lg
});

export const ChatBotContent: React.FC<ChatBotContentProps> = ({ chatHistoryEndRef }) => {
  const dispatch = useDispatch();
  const chatHistory: ImmutableList<ImmutableMap<string, unknown>> = useSelector(
    (s: KialiAppState) => s.ai.chat.chatHistory
  );
  const starterPrompts = React.useMemo<StarterPrompt[]>(
    () => [
      {
        id: 'what-can-you-help-with',
        title: t('What can you help me with?'),
        message: t('Learn what the chatbot can do in Kiali.'),
        onClick: () => dispatch(ChatAIActions.setQuery(t('What can you help me with in Kiali?')))
      }
    ],
    [dispatch]
  );

  return (
    <ChatbotContent>
      <MessageBox>
        {chatHistory.size === 0 && (
          <div className={starterPromptsStyle} data-test="chatbot-starter-prompts">
            {starterPrompts.map(prompt => (
              <Card key={prompt.id} className="pf-chatbot__prompt-suggestion" isClickable isCompact>
                <CardHeader
                  selectableActions={{
                    onClickAction: prompt.onClick,
                    selectableActionAriaLabelledby: `starter-prompt-title-${prompt.id}`,
                    selectableActionId: `starter-prompt-input-${prompt.id}`
                  }}
                >
                  <CardTitle id={`starter-prompt-title-${prompt.id}`}>{prompt.title}</CardTitle>
                </CardHeader>
                <CardBody>{prompt.message}</CardBody>
              </Card>
            ))}
          </div>
        )}
        {chatHistory.map((entry, i) => (
          <EntryChat entryIndex={i} key={(entry.get('id') as string) ?? `${entry.get('who')}-${entry.get('text')}`} />
        ))}
        <div ref={chatHistoryEndRef} />
      </MessageBox>
    </ChatbotContent>
  );
};
