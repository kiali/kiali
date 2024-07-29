import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { useKialiTranslation } from 'utils/I18nUtils';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { KialiIcon } from 'config/KialiIcon';
import { download } from 'utils/Common';
import { dump } from 'js-yaml';
import { aceOptions, yamlDumpOptions } from 'types/IstioConfigDetails';
import { istioAceEditorStyle } from '../../../styles/AceEditorStyle';
import AceEditor from 'react-ace';
import ReactAce from 'react-ace/lib/ace';

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

interface TargetPanelEditorProps {
  configMap: string;
  targetName: string;
}

export const TargetPanelEditor: React.FC<TargetPanelEditorProps> = (props: TargetPanelEditorProps) => {
  const [copied, setCopied] = React.useState<boolean>(false);

  const { t } = useKialiTranslation();

  const copyText = dump(props.configMap, yamlDumpOptions);

  const aceEditorRef = React.useRef<ReactAce | null>(null);

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
      <AceEditor
        ref={aceEditorRef}
        mode="yaml"
        theme={'eclipse'}
        width="100%"
        className={istioAceEditorStyle}
        wrapEnabled={true}
        readOnly={true}
        setOptions={aceOptions ?? { foldStyle: 'markbegin' }}
        value={props.configMap}
      />
    </>
  );
};
