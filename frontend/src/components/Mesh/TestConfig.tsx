import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';
import AceEditor from 'react-ace';
import { Theme } from '../../types/Common';
import { istioAceEditorStyle } from '../../styles/AceEditorStyle';
import { aceOptions, yamlDumpOptions } from '../../types/IstioConfigDetails';
import { getKialiTheme } from '../../utils/ThemeUtils';
import { dump } from 'js-yaml';
import ReactAce from 'react-ace/lib/ace';
import { ValidationTypes } from 'types/IstioObjects';
import { kialiStyle } from '../../styles/StyleUtils';
import { Validation } from '../Validations/Validation';

type CheckModalProps = {
  configData?: unknown;
};

const healthStatusStyle = kialiStyle({
  marginLeft: '0.5rem'
});

export const TestConfig: React.FC<CheckModalProps> = (props: CheckModalProps) => {
  const { t } = useKialiTranslation();
  const aceEditorRef = React.useRef<ReactAce | null>(null);

  const theme = getKialiTheme();
  const [configResult, setConfigResult] = React.useState<string | null>(null);

  const getConfigToString = dump(props.configData, {
    noRefs: true,
    skipInvalid: true,
    ...yamlDumpOptions
  });

  const showResult = (): React.ReactElement => {
    let healthSeverity: ValidationTypes;
    switch (configResult) {
      case 'Ok':
        healthSeverity = ValidationTypes.Correct;
        break;
      case 'Error':
        healthSeverity = ValidationTypes.Warning;
        break;
      default:
        healthSeverity = ValidationTypes.Error;
    }

    return (
      <Tooltip
        aria-label={t('Health status')}
        position={TooltipPosition.right}
        enableFlip={true}
        content={<>{t('Configuration returned valid results')}</>}
      >
        <span className={healthStatusStyle}>
          <Validation severity={healthSeverity} />
        </span>
      </Tooltip>
    );
  };

  const handleTestConfig = (): void => {
    // TODO
    setConfigResult('Ok');
  };

  return (
    <div style={{ paddingTop: '10px' }}>
      <span>{t('external_services.tracing configuration:')}</span>
      <AceEditor
        ref={aceEditorRef}
        mode="yaml"
        theme={theme === Theme.DARK ? 'twilight' : 'eclipse'}
        width="100%"
        className={istioAceEditorStyle}
        wrapEnabled={true}
        readOnly={false}
        setOptions={aceOptions ?? { foldStyle: 'markbegin' }}
        value={getConfigToString}
      />
      <Button style={{ marginTop: '10px' }} variant={ButtonVariant.secondary} onClick={handleTestConfig}>
        {t('Test Config')}
      </Button>
      {configResult ? showResult() : ''}
    </div>
  );
};
