import { Message, SourcesCardProps } from '@patternfly/chatbot';
import React from 'react';
import { useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { ChatEntry, ReferencedDoc } from 'types/Chatbot';
import { copyToClipboard } from './clipboard';
import { Alert } from '@patternfly/react-core';
import { t } from 'utils/I18nUtils';
import { ResponseTools } from './ResponseTools';
import userAvatar from '../../../assets/img/kiali/ai/img_avatar-light.svg';
import aiAvatar from '../../../assets/img/kiali/ai/img-ai-lightbkg.svg';
import aiAvatarDark from '../../../assets/img/kiali/ai/img-ai-darkbkg.svg';
import { useKialiTheme } from 'utils/ThemeUtils';
import { Theme } from 'types/Common';
import { Actions } from './Actions';
import { ChatMessageMarkdown } from './ChatMessageMarkdown';

type EntryChatProps = {
  entryIndex: number;
};

export const EntryChat = React.memo(({ entryIndex }: EntryChatProps) => {
  const entryObject = useSelector((state: KialiAppState) => state.aiChat.chatHistory.getIn([entryIndex])) as any;
  const entry = entryObject.toJS() as ChatEntry;
  const isDarkTheme = useKialiTheme() === Theme.DARK;

  if (entry.who === 'user' && entry.hidden) {
    return null;
  }

  if (entry.who === 'ai') {
    const actions = entry.error
      ? undefined
      : {
          copy: { onClick: () => copyToClipboard(entry.text ?? '') }
        };
    let sources: SourcesCardProps | undefined;
    if (Array.isArray(entry.references) && entry.references.length > 0) {
      const references: ReferencedDoc[] = entry.references.filter(
        r => r && typeof r.doc_title === 'string' && typeof r.doc_url === 'string' && r.doc_url.startsWith('http')
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
    const hasActions = entry.actions && entry.actions.length > 0;

    // Markdown safe content
    const safeContent = typeof entry.text === 'string' ? entry.text : entry.text ? String(entry.text) : '';
    const markdownContent = safeContent ? (
      <ChatMessageMarkdown
        content={safeContent}
        codeBlockProps={{}}
        hasNavigationActions={entry.actions?.some(action => action.kind === 'navigation')}
        openLinkInNewTab={true}
      />
    ) : null;

    return (
      <Message
        actions={actions}
        avatar={isDarkTheme ? aiAvatarDark : aiAvatar}
        avatarProps={{ size: 'sm' }}
        codeBlockProps={{ isExpandable: true }}
        content={markdownContent ? undefined : safeContent}
        data-test="kiali__chat-entry-ai"
        extraContent={{
          ...(markdownContent
            ? {
                beforeMainContent: <>{markdownContent}</>
              }
            : {}),
          afterMainContent: (
            <>
              {entry.error && (
                <Alert
                  isExpandable={!!entry.error.moreInfo}
                  isInline
                  title={entry.error.moreInfo ? entry.error.message : t('Error querying Kiali AI')}
                  variant="danger"
                >
                  {entry.error.moreInfo ? entry.error.moreInfo : entry.error.message}
                </Alert>
              )}
              {entry.isCancelled && <Alert isInline isPlain title={t('Cancelled')} variant="info" />}
              {entry.tools && <ResponseTools entryIndex={entryIndex} />}
              {hasActions && <Actions entryIndex={entryIndex} />}
            </>
          )
        }}
        hasRoundAvatar={false}
        isCompact
        isLoading={entry.isStreaming && !entry.isCancelled && !entry.error}
        name="Kiali AI"
        role="bot"
        sources={sources}
        timestamp=" "
      />
    );
  }

  if (entry.who === 'user') {
    return (
      <Message
        avatar={userAvatar}
        avatarProps={{ size: 'sm' }}
        data-test="kiali__chat-entry-user"
        extraContent={{
          afterMainContent: (
            <>
              <div>{entry.text}</div>
            </>
          )
        }}
        hasRoundAvatar={false}
        isCompact
        name={t('You')}
        role="user"
        timestamp=" "
      />
    );
  }
  return null;
});
EntryChat.displayName = 'EntryChat';
