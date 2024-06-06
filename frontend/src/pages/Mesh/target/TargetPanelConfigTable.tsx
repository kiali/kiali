import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { JsonTable } from 'components/Table/JsonTable';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { KialiIcon } from 'config/KialiIcon';
import { Json } from 'types/Common';
import { download } from 'utils/Common';

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

interface TargetPanelConfigTableProps {
  configData: Json;
  targetName: string;
  width: string;
}

export const TargetPanelConfigTable: React.FC<TargetPanelConfigTableProps> = (props: TargetPanelConfigTableProps) => {
  const [copied, setCopied] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();

  const copyText = JSON.stringify(props.configData, null, 2);

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
              onClick={() => download(copyText, `configuration_${props.targetName}.json`)}
            >
              <KialiIcon.Download />
              <span className={iconStyle}>{t('Download')}</span>
            </Button>
          </Tooltip>
        </div>
      </div>

      <JsonTable label={t('Configuration')} jsonData={props.configData} width={props.width} />
    </>
  );
};
