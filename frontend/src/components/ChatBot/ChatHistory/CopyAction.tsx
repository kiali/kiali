import * as React from 'react';
import { useTranslation } from 'react-i18next';
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
      exitDelay={isCopied ? 1500 : 600}
      id="ols-plugin-copy-button"
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
