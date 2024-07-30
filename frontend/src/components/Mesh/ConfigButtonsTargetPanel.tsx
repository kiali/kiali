import * as React from 'react';
import { kialiStyle } from '../../styles/StyleUtils';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import CopyToClipboard from 'react-copy-to-clipboard';
import { download } from '../../utils/Common';

const configTitleStyle = kialiStyle({
  display: 'flex',
  justifyContent: 'space-between'
});

const iconStyle = kialiStyle({
  marginLeft: '0.25rem'
});

const downloadButtonStyle = kialiStyle({
  marginLeft: '0.5rem'
});

interface ConfigButtonsTargetPanelProps {
  copyText: string;
  targetName: string;
}

export const ConfigButtonsTargetPanel: React.FC<ConfigButtonsTargetPanelProps> = (
  props: ConfigButtonsTargetPanelProps
) => {
  const [copied, setCopied] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();
  const copyText = props.copyText;

  return (
    <>
      <div className={configTitleStyle}>
        <span>{t('Configuration:')}</span>
        <div>
          <Tooltip
            content={<>{t(copied ? 'Copied' : 'Copy configuration')}</>}
            onTooltipHidden={() => setCopied(false)}
          >
            <CopyToClipboard text={copyText}>
              <Button variant={ButtonVariant.link} aria-label={t('Copy')} isInline onClick={() => setCopied(true)}>
                <KialiIcon.Copy />
                <span className={iconStyle}>{t('Copy')}</span>
              </Button>
            </CopyToClipboard>
          </Tooltip>

          <Tooltip content={<>{t('Download configuration in a file')}</>}>
            <Button
              variant={ButtonVariant.link}
              isInline
              aria-label={t('Download')}
              className={downloadButtonStyle}
              onClick={() => download(copyText, `configuration_${props.targetName}.yaml`)}
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
