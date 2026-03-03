import * as React from 'react';
import { Trans } from 'react-i18next';
import { Alert, CodeBlock, CodeBlockAction, CodeBlockCode, Icon, Modal, ModalVariant, ModalHeader, Content, ModalBody, ClipboardCopyButton } from '@patternfly/react-core';
import { InfoCircleIcon } from '@patternfly/react-icons';
import { Tool } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import { style } from 'typestyle';
import { PFFontWeight } from 'styles/PfTypography';
import { PFSpacer } from 'styles/PfSpacer';


type ResponseToolModalProps = {
  isOpen: boolean;
  onClose: () => void;
  tool: Tool | undefined;
};

export const ResponseToolModal: React.FC<ResponseToolModalProps> = ({ isOpen, onClose, tool }) => {
  const [isCopied, setIsCopied] = React.useState(false);
  if (!tool) {
    return null;
  }
  const {args, content, name, status} = tool;

  const argsFormatted = Object.entries(args)
    .map(([key, value]) => `${key}=${value}`)
    .join(', ');

  return (
    <Modal
      variant={ModalVariant.large}
      isOpen={isOpen}
      onClose={onClose}
    >
        <ModalHeader>   
            <Content>
                <h1><Icon status={status === 'error' ? 'danger' : 'info'}>
            <InfoCircleIcon />
          </Icon> Tool output</h1>
            </Content>
        </ModalHeader>
        <ModalBody>
                {status === 'error' && (
                <Alert
                className="ols-plugin__alert"
                isInline
                title={t('An unexpected error occurred')}
                variant="danger"
                >
                {t('Please retry or contact support if the issue persists.')}
                </Alert>
            )}
            {argsFormatted? (
                <Trans>
                    The following output was generated when running{' '}
                    <span className={style({fontWeight: PFFontWeight.BodyBold})}>{{ name }}</span> with arguments{' '}
                    <span className={style({fontWeight: PFFontWeight.BodyBold})}>{{ argsFormatted }}</span>.
                </Trans>
            ) : (
                <Trans>
                    The following output was generated when running{' '}
                    <span className={style({fontWeight: PFFontWeight.BodyBold})}>{{ name }}</span> with no arguments.
                </Trans>
            )}
            {content ? (
                <CodeBlock
                className={style({marginTop: PFSpacer.md})}
                actions={           
                    <CodeBlockAction>
                        <ClipboardCopyButton 
                        aria-label={t('Copy to clipboard')}
                        value={content}
                        variant="plain"
                        id="copy-to-clipboard-button"
                        onClick={() => {
                            setIsCopied(true);
                            navigator.clipboard.writeText(content);
                        }}
                        >
                            {isCopied ? t('Copied') : t('Copy to clipboard')}
                        </ClipboardCopyButton>
                    </CodeBlockAction>
                }
                >
                <CodeBlockCode>{content}</CodeBlockCode>
                </CodeBlock>
            ) : (
                <Alert
                isInline
                title={t('No output returned')}
                variant="info"
                />
            )}
        </ModalBody>
    </Modal>
     
  );
};
