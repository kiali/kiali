import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { Trans } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  Alert,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  DescriptionList,
  DescriptionListDescription,
  DescriptionListGroup,
  DescriptionListTerm,
  Icon,
  Label,
  Modal,
  ModalBody,
  ModalHeader,
  Title
} from '@patternfly/react-core';
import { BanIcon, InfoCircleIcon } from '@patternfly/react-icons';
import { CopyAction } from './CopyAction';
import { KialiAppState } from 'store/Store';
import { ChatAIActions } from 'actions/ChatAIActions';
import { t } from 'utils/I18nUtils';

export const ToolModal: React.FC = () => {
  const dispatch = useDispatch();

  const tool: ImmutableMap<string, unknown> = useSelector((state: KialiAppState) => {
    const openTool = state.aiChat.openTool as any;
    return state.aiChat.chatHistory.getIn([openTool.get('chatEntryIndex'), 'tools', openTool.get('id')]);
  }) as ImmutableMap<string, unknown>;

  const onClose = React.useCallback(() => {
    dispatch(ChatAIActions.clearOpenTool());
  }, [dispatch]);

  if (!tool) {
    return null;
  }

  const { args, content, isDenied, name, serverName, status, structuredContent, uiResourceUri } = tool.toJS() as {
    args: Record<string, unknown>;
    content: string;
    isDenied?: boolean;
    name: string;
    serverName?: string;
    status: string;
    structuredContent?: Record<string, unknown>;
    uiResourceUri?: string;
  };

  const argsFormatted = Object.entries(args ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  const structuredContentFormatted = structuredContent ? JSON.stringify(structuredContent, null, 2) : undefined;

  return (
    <Modal data-test="ai-tool-modal" isOpen={true} onClose={onClose} width="80%">
      <ModalHeader>
        <Icon isInline status={isDenied ? undefined : status === 'error' ? 'danger' : 'info'}>
          {isDenied ? <BanIcon color="var(--pf-t--global--icon--color--subtle)" /> : <InfoCircleIcon />}
        </Icon>{' '}
        {isDenied ? t('Tool call rejected') : t('Tool output')}
      </ModalHeader>
      <ModalBody>
        {!isDenied && status === 'error' && (
          <Alert isInline title={t('An unexpected error occurred')} variant="danger">
            {t('Please retry or contact support if the issue persists.')}
          </Alert>
        )}
        <p>
          {isDenied ? (
            argsFormatted ? (
              <Trans i18nKey="toolModal.deniedWithArgs">
                The tool <span>{{ name }}</span> was requested with arguments <span>{{ argsFormatted }}</span> but was
                rejected.
              </Trans>
            ) : (
              <Trans i18nKey="toolModal.deniedNoArgs">
                The tool <span>{{ name }}</span> was requested with no arguments but was rejected.
              </Trans>
            )
          ) : argsFormatted ? (
            <Trans i18nKey="toolModal.outputWithArgs">
              The following output was generated when running <span>{{ name }}</span> with arguments{' '}
              <span>{{ argsFormatted }}</span>.
            </Trans>
          ) : (
            <Trans i18nKey="toolModal.outputNoArgs">
              The following output was generated when running <span>{{ name }}</span> with no arguments.
            </Trans>
          )}
        </p>

        <DescriptionList isCompact isHorizontal>
          {!isDenied && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t('Status')}</DescriptionListTerm>
              <DescriptionListDescription>
                <Label color={status === 'error' ? 'red' : status === 'success' ? 'green' : 'yellow'}>
                  {status ?? t('pending')}
                </Label>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {serverName && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t('MCP server')}</DescriptionListTerm>
              <DescriptionListDescription>{serverName}</DescriptionListDescription>
            </DescriptionListGroup>
          )}
          {uiResourceUri && (
            <DescriptionListGroup>
              <DescriptionListTerm>{t('UI resource')}</DescriptionListTerm>
              <DescriptionListDescription>
                <span>{uiResourceUri}</span>
              </DescriptionListDescription>
            </DescriptionListGroup>
          )}
        </DescriptionList>

        {isDenied ? null : content ? (
          <>
            <Title headingLevel="h4">{t('Content')}</Title>
            <CodeBlock
              actions={
                <>
                  <CodeBlockAction />
                  <CodeBlockAction>
                    <CopyAction value={content} />
                  </CodeBlockAction>
                </>
              }
            >
              <CodeBlockCode>{content}</CodeBlockCode>
            </CodeBlock>
          </>
        ) : (
          status && <Alert isInline title={t('No output returned')} variant="info" />
        )}

        {!isDenied && structuredContentFormatted && (
          <>
            <Title headingLevel="h4">{t('Structured content')}</Title>
            <CodeBlock
              actions={
                <>
                  <CodeBlockAction />
                  <CodeBlockAction>
                    <CopyAction value={structuredContentFormatted} />
                  </CodeBlockAction>
                </>
              }
            >
              <CodeBlockCode>{structuredContentFormatted}</CodeBlockCode>
            </CodeBlock>
          </>
        )}
      </ModalBody>
    </Modal>
  );
};
