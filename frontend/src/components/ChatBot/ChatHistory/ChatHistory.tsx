import { Message, SourcesCardProps } from '@patternfly/chatbot';
import { Alert, Button, CodeBlock, CodeBlockAction, CodeBlockCode } from '@patternfly/react-core';
import React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { ChatEntry, ReferencedDoc } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import { ResponseTools } from './ResponseTools';
import { CopyAction } from './CopyAction';
import { router } from 'app/History';
import { ArrowRightIcon } from '@patternfly/react-icons';
import { FileAttachment } from '../ChatMessage/FileAttachment';

const isURL = (s: string): boolean => {
  try {
    const url = new URL(s);
    return !!(url.protocol && url.host);
  } catch {
    return false;
  }
};

const Code = ({ children }: { children?: React.ReactNode }) => {
  if (!children || !String(children).includes('\n')) {
    return <code>{children}</code>;
  }

  return (
    <CodeBlock
      actions={
        <CodeBlockAction>
          <CopyAction value={children.toString()} />
        </CodeBlockAction>
      }
      className="ols-plugin__code-block"
    >
      <CodeBlockCode className="ols-plugin__code-block-code">{children}</CodeBlockCode>
    </CodeBlock>
  );
};

type ChatHistoryEntryProps = {
  conversationID: string;
  entryIndex: number;
};

export const ChatHistoryEntry = React.memo(({ conversationID, entryIndex }: ChatHistoryEntryProps) => {
  const dispatch = useDispatch();
  const entryMap = useSelector((s: KialiAppState) => s.aiChat.get('chatHistory').get(entryIndex));
  const entry: ChatEntry = entryMap.toJS() as ChatEntry;
  const query: string = useSelector((s: KialiAppState) =>
    s.aiChat
      .get('chatHistory')
      .get(entryIndex - 1)
      .get('text')
  );
  const response: string = useSelector((s: KialiAppState) => s.aiChat.get('chatHistory').get(entryIndex).get('text'));
  const displayMode: ChatbotDisplayMode = useSelector((s: KialiAppState) => s.aiChatSettings.displayMode);

  if (entry.who === 'ai') {
    let sources: SourcesCardProps | undefined;
    if (Array.isArray(entry.references)) {
      const references: ReferencedDoc[] = entry.references.filter(
        r => r && typeof r.doc_title === 'string' && typeof r.doc_url === 'string' && isURL(r.doc_url)
      );
      if (references.length > 0) {
        sources = {
          sources: references.map(r => ({
            isExternal: true,
            title: r.doc_title,
            link: r.doc_url
          }))
        };
      }
    }
    let actions: React.ReactNode[] | undefined = undefined;
    if (Array.isArray(entry.actions)) {
      actions = [];
      entry.actions.forEach(action => {
        if (action.kind === 'navigation') {
          actions.push(
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 1rem' }}>
              <Button
                icon={<ArrowRightIcon />}
                key={`chatbot_action_${action.title}`}
                onClick={() => router.navigate(action.payload)}
                variant="link"
                isInline
              >
                {action.title}
              </Button>
            </div>
          );
        } else if (action.kind === 'file') {
          actions.push(
            <div style={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
              <FileAttachment
                key={action.fileName}
                fileName={action.fileName || ''}
                code={action.payload}
                displayMode={displayMode}
              />
            </div>
          );
        }
      });
    }

    return (
      <>
        <Message
          content={entry.text}
          data-test="kiali-chatbot_chat-entry-ai"
          extraContent={{
            afterMainContent: (
              <>
                {entry.error && (
                  <Alert
                    isExpandable={!!entry.error.moreInfo}
                    isInline
                    title={
                      entry.error.moreInfo ? entry.error.message : t('Error querying OpenShift Lightspeed service')
                    }
                    variant="danger"
                  >
                    {entry.error.moreInfo ? entry.error.moreInfo : entry.error.message}
                  </Alert>
                )}
                {entry.isTruncated && (
                  <Alert isInline title={t('History truncated')} variant="warning">
                    {t('Conversation history has been truncated to fit within context window.')}
                  </Alert>
                )}
                {entry.isCancelled && (
                  <Alert
                    className="ols-plugin__chat-entry-cancelled"
                    isInline
                    isPlain
                    title={t('Cancelled')}
                    variant="info"
                  />
                )}
                {entry.tools && <ResponseTools entryIndex={entryIndex} />}
              </>
            )
          }}
          hasRoundAvatar={false}
          isCompact={true}
          isLoading={!entry.text && !entry.isCancelled && !entry.error}
          name="Kiali AI"
          reactMarkdownProps={{ components: { code: Code } }}
          role="bot"
          sources={sources}
          timestamp=" "
        />
        {actions && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '0 0 1rem 5rem' }}>
            {actions}
          </div>
        )}
      </>
    );
  }

  if (entry.who === 'user') {
    return (
      <Message
        avatarProps={{ className: 'kiali-chatbot__avatar', isBordered: true }}
        data-test="kiali-chatbot_chat-entry-user"
        extraContent={{
          afterMainContent: <>{entry.text}</>
        }}
        hasRoundAvatar={false}
        isCompact
        name="You"
        role="user"
        timestamp=" "
      />
    );
  }

  return null;
});
ChatHistoryEntry.displayName = 'ChatHistoryEntry';
