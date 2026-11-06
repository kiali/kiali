import * as React from 'react';
import { kialiStyle } from '../../styles/StyleUtils';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { PlainTextClipboardCopyButton } from 'components/Copy/PlainTextClipboardCopyButton';
import { download } from '../../utils/Common';

const configTitleStyle = (includeTitle?: boolean): string =>
  kialiStyle({
    display: 'flex',
    justifyContent: includeTitle ? 'space-between' : 'flex-end'
  });

const iconStyle = kialiStyle({
  marginLeft: '0.25rem'
});

const downloadButtonStyle = kialiStyle({
  marginLeft: '0.5rem'
});

interface ConfigButtonsTargetPanelProps {
  copyText: string;
  includeTitle?: boolean;
  targetName: string;
}

export const ConfigButtonsTargetPanel: React.FC<ConfigButtonsTargetPanelProps> = ({
  copyText,
  includeTitle = true,
  targetName
}) => {
  const { t } = useKialiTranslation();

  return (
    <>
      <div className={configTitleStyle(includeTitle)}>
        {includeTitle && <span>{t('Configuration:')}</span>}
        <div>
          <PlainTextClipboardCopyButton
            appearance="link"
            ariaLabel={t('Copy')}
            copiedTooltip={t('Copied')}
            copyTooltip={t('Copy configuration')}
            id="mesh-target-config-copy"
            label={t('Copy')}
            labelClassName={iconStyle}
            text={copyText}
          />

          <Tooltip content={<>{t('Download configuration in a file')}</>}>
            <Button
              variant={ButtonVariant.link}
              isInline
              aria-label={t('Download')}
              className={downloadButtonStyle}
              onClick={() => download(copyText, `configuration_${targetName}.yaml`)}
            >
              <KialiIcon.Download />
              <span className={iconStyle}>{t('Download')}</span>
            </Button>
          </Tooltip>
        </div>
      </div>
    </>
  );
};
