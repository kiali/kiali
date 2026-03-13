import { Map as ImmutableMap } from 'immutable';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Alert, CodeBlock, CodeBlockAction, CodeBlockCode, Icon } from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';

import { CopyAction } from '../ChatHistory/CopyAction';
import { Modal } from './Modal';
import { KialiAppState } from 'store/Store';
import { chatOpenToolClear } from 'actions/ChatAIActions';
import { t } from 'utils/I18nUtils';

export const ToolModal: React.FC = () => {
  const dispatch = useDispatch();

  const tool: ImmutableMap<string, unknown> = useSelector((s: KialiAppState) => {
    const openTool = s.aiChat?.get('openTool');
    if (!openTool) {
      return null;
    }

    const chatHistory = s.aiChat?.get('chatHistory');
    if (!chatHistory) {
      return null;
    }
    const chatEntry = chatHistory.get(openTool.get('chatEntryIndex'));
    if (!chatEntry) {
      return null;
    }
    const tools = chatEntry.get('tools');
    if (!tools) {
      return null;
    }
    return tools.get(openTool.get('id')) as ImmutableMap<string, unknown>;
  });

  const onClose = React.useCallback(() => {
    dispatch(chatOpenToolClear());
  }, [dispatch]);

  if (!tool) {
    return null;
  }
  const { args, content, name, status } = tool.toJS();

  const argsFormatted = Object.entries(args)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  return (
    <Modal
      className="ols-plugin__attachment-modal"
      isOpen={true}
      onClose={onClose}
      title={
        <>
          <Icon status={status === 'error' ? 'danger' : 'info'}>
            <InfoCircleIcon />
          </Icon>{' '}
          {t('Tool output')}
        </>
      }
    >
      {status === 'error' && (
        <Alert
          className="kiali-chatbot-plugin__alert"
          isInline
          title={t('An unexpected error occurred')}
          variant="danger"
        >
          {t('Please retry or contact support if the issue persists.')}
        </Alert>
      )}
      <p>
        {argsFormatted ? (
          <>
            The following output was generated when running{' '}
            <span className="kiali-chatbot-plugin__code-inline">{name}</span> with arguments{' '}
            <span className="kiali-chatbot-plugin__code-inline">{argsFormatted}</span>.
          </>
        ) : (
          <>
            The following output was generated when running{' '}
            <span className="kiali-chatbot-plugin__code-inline">{name}</span> with no arguments.
          </>
        )}
      </p>
      {content ? (
        <CodeBlock
          actions={
            <>
              <CodeBlockAction />
              <CodeBlockAction>
                <CopyAction value={content} />
              </CodeBlockAction>
            </>
          }
          className="kiali-chatbot-plugin__code-block kiali-chatbot-plugin__code-block--attachment"
        >
          <CodeBlockCode className="kiali-chatbot-plugin__code-block-code">{content}</CodeBlockCode>
        </CodeBlock>
      ) : (
        <Alert className="kiali-chatbot-plugin__alert" isInline title={t('No output returned')} variant="info" />
      )}
    </Modal>
  );
};
