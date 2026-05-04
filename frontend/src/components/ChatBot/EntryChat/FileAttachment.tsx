import React from 'react';
import AceEditor from 'react-ace';
import { FileDetailsLabel } from '@patternfly/chatbot';
import { Button, Stack, StackItem } from '@patternfly/react-core';
import { Modal, ModalVariant } from '@patternfly/react-core/deprecated';
import { t } from 'utils/I18nUtils';
import { Action } from 'types/Chatbot';
import { Theme } from 'types/Common';
import { useKialiTheme } from 'utils/ThemeUtils';
import { load } from 'js-yaml';
import * as API from 'services/Api';
import axios from 'axios';
import { useDispatch } from 'react-redux';
import { ChatAIActions } from 'actions/ChatAIActions';
import { uniqueId } from 'lodash-es';

type FileAttachmentProps = {
  action: Action;
  fileName: string;
  onSendMessage?: (query: string | number, context?: any, title?: string) => void;
};

const toJsonString = (yamlText: string): string => {
  const obj = load(yamlText);
  return JSON.stringify(obj ?? {});
};

export const FileAttachment: React.FC<FileAttachmentProps> = ({ action, fileName, onSendMessage }) => {
  const dispatch = useDispatch();
  const [isModalOpen, setIsModalOpen] = React.useState<boolean>(false);
  const [yamlText, setYamlText] = React.useState<string>(action.payload ?? '');
  const theme = useKialiTheme();
  const isDarkTheme = theme === Theme.DARK;

  React.useEffect(() => {
    setYamlText(action.payload ?? '');
  }, [action.payload]);

  const toggle = (): void => setIsModalOpen(prev => !prev);

  const canApply = action.operation === 'create' || action.operation === 'patch' || action.operation === 'delete';
  const hasIstioMeta =
    !!action.namespace &&
    !!action.group &&
    !!action.version &&
    !!action.kindName &&
    (action.operation !== 'patch' || !!action.object);

  const applyLabel =
    action.operation === 'create'
      ? t('Create')
      : action.operation === 'patch'
      ? t('Patch')
      : action.operation === 'delete'
      ? t('Delete')
      : t('Apply');

  const onApply = async (): Promise<void> => {
    if (!canApply || !action.operation) {
      dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: uniqueId('ChatEntry_'),
            error: { message: t('Cannot apply: missing operation.') },
            who: 'ai',
            isCancelled: false,
            isTruncated: false,
            isStreaming: false
          }
        })
      );
      return;
    }
    if (!hasIstioMeta) {
      // Fallback: send to chat so the model can proceed using its tool memory.
      if (onSendMessage) {
        const prompt = `Please proceed with the ${action.operation} using this YAML:\n\n~~~\n${yamlText}\n~~~\n`;
        onSendMessage(prompt, '');
        toggle();
        return;
      }
      dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: uniqueId('ChatEntry_'),
            error: {
              message: t('Cannot apply directly: missing Istio metadata (namespace/group/version/kind/object).')
            },
            who: 'ai',
            isCancelled: false,
            isTruncated: false,
            isStreaming: false
          }
        })
      );
      return;
    }

    try {
      const gvk: any = { Group: action.group, Version: action.version, Kind: action.kindName };
      if (action.operation === 'create') {
        const json = toJsonString(yamlText);
        await API.createIstioConfigDetail(action.namespace!, gvk, json, action.cluster);
        const successMsg = `Successfully created **${action.kindName}/${action.object ?? ''}** in namespace **${
          action.namespace
        }**`;
        dispatch(
          ChatAIActions.setChatHistoryAdd({
            entry: {
              id: uniqueId('ChatEntry_'),
              text: successMsg,
              who: 'ai',
              isCancelled: false,
              isTruncated: false,
              isStreaming: false
            }
          })
        );
      } else if (action.operation === 'patch') {
        const jsonPatch = toJsonString(yamlText);
        await API.updateIstioConfigDetail(action.namespace!, gvk, action.object!, jsonPatch, action.cluster);
        const successMsg = `Successfully patched **${action.kindName}/${action.object}** in namespace **${action.namespace}**`;
        dispatch(
          ChatAIActions.setChatHistoryAdd({
            entry: {
              id: uniqueId('ChatEntry_'),
              text: successMsg,
              who: 'ai',
              isCancelled: false,
              isTruncated: false,
              isStreaming: false
            }
          })
        );
      } else if (action.operation === 'delete') {
        await API.deleteIstioConfigDetail(action.namespace!, gvk, action.object!, action.cluster);
        const successMsg = `Successfully deleted **${action.kindName}/${action.object}** from namespace **${action.namespace}**`;
        dispatch(
          ChatAIActions.setChatHistoryAdd({
            entry: {
              id: uniqueId('ChatEntry_'),
              text: successMsg,
              who: 'ai',
              isCancelled: false,
              isTruncated: false,
              isStreaming: false
            }
          })
        );
      }
      toggle();
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? e?.response?.data?.error || e?.message || String(e)
        : e instanceof Error
        ? e.message
        : String(e);
      dispatch(
        ChatAIActions.setChatHistoryAdd({
          entry: {
            id: uniqueId('ChatEntry_'),
            text: `**Error:** Failed to ${action.operation} **${action.kindName}/${
              action.object ?? ''
            }** in namespace **${action.namespace}**: ${msg}`,
            error: { message: msg },
            who: 'ai',
            isCancelled: false,
            isTruncated: false,
            isStreaming: false
          }
        })
      );
      toggle();
    }
  };

  return (
    <div key={fileName}>
      <FileDetailsLabel fileName={fileName} onClick={toggle} />
      <Modal
        ouiaId="chatbot-yaml-modal"
        title={action.title || fileName}
        variant={ModalVariant.large}
        isOpen={isModalOpen}
        onClose={toggle}
        actions={
          [
            canApply ? (
              <Button key="apply" variant="primary" onClick={onApply}>
                {applyLabel}
              </Button>
            ) : null,
            <Button key="close" variant="link" onClick={toggle}>
              {t('Close')}
            </Button>
          ].filter(Boolean) as any
        }
      >
        <Stack hasGutter>
          <StackItem>
            <AceEditor
              mode="yaml"
              theme={isDarkTheme ? 'twilight' : 'eclipse'}
              width="100%"
              height="350px"
              value={yamlText}
              onChange={(v: string) => setYamlText(v)}
              wrapEnabled={true}
              setOptions={{ useWorker: false, tabSize: 2 }}
            />
          </StackItem>
        </Stack>
      </Modal>
    </div>
  );
};
