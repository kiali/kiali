import * as React from 'react';
import { ClipboardCopyButton } from '@patternfly/react-core';

import { copyToClipboard } from './clipboard';
import { useBoolean } from '../hooks/useBoolean';
import { t } from 'utils/I18nUtils';

type Props = {
  className?: string;
  value: string;
};

export const CopyAction: React.FC<Props> = ({ className, value }) => {
  const [isCopied, , setCopied, setNotCopied] = useBoolean(false);

  return (
    <ClipboardCopyButton
      aria-label={t('Copy to clipboard')}
      className={className}
      id="ai-copy-button"
      exitDelay={isCopied ? 1500 : 600}
      data-test="ai-copy-button"
      onClick={() => {
        copyToClipboard(value);
        setCopied();
      }}
      onTooltipHidden={setNotCopied}
      textId="code-content"
      variant="plain"
    >
      {isCopied ? t('Copied') : t('Copy to clipboard')}
    </ClipboardCopyButton>
  );
};
