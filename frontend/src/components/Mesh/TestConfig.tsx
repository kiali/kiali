import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Spinner, Tooltip, TooltipPosition } from '@patternfly/react-core';
import AceEditor from 'react-ace';
import { Theme } from '../../types/Common';
import { istioAceEditorStyle } from '../../styles/AceEditorStyle';
import { aceOptions, yamlDumpOptions } from '../../types/IstioConfigDetails';
import { getKialiTheme } from '../../utils/ThemeUtils';
import { dump, loadAll } from 'js-yaml';
import ReactAce from 'react-ace/lib/ace';
import { ValidationTypes } from 'types/IstioObjects';
import { kialiStyle } from '../../styles/StyleUtils';
import { Validation } from '../Validations/Validation';
import * as API from '../../services/Api';

type CheckModalProps = {
  configData?: unknown;
};

const healthStatusStyle = kialiStyle({
  marginLeft: '0.5rem'
});

export const TestConfig: React.FC<CheckModalProps> = (props: CheckModalProps) => {
  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState('');
  const [isModified, setIsModified] = React.useState(false);
  const [modifiedConfig, setModifiedConfig] = React.useState<string>('');
  const aceEditorRef = React.useRef<ReactAce | null>(null);
  const [source, setSource] = React.useState<string>('');

  const theme = getKialiTheme();
  const [configResult] = React.useState<string | null>(null);

  const testConfig = (): void => {
    loadAll(modifiedConfig, objectModified => {
      setLoading(true);
      const jsonPatch = JSON.stringify(objectModified).replace(new RegExp('(,null)+]', 'g'), ']');

      return API.testTracingConfig(jsonPatch)
        .then(response => {
          setModifiedConfig(response.data);
          setSource(dump(props.configData, yamlDumpOptions));
          setLoading(false);
        })
        .catch(err => {
          setLoading(false);
          setError(err);
        });
    });
  };

  const showResult = (): React.ReactElement => {
    let healthSeverity: ValidationTypes;
    if (error) {
      healthSeverity = ValidationTypes.Error;
    } else {
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
    testConfig();
  };

  const onEditorChange = (value: string): void => {
    setSource(value);
    setIsModified(true);
  };

  return (
    <div style={{ paddingTop: '10px' }}>
      <span>{t('external_services.tracing configuration:')}</span>
      <AceEditor
        ref={aceEditorRef}
        mode="yaml"
        theme={theme === Theme.DARK ? 'twilight' : 'eclipse'}
        onChange={onEditorChange}
        width="100%"
        className={istioAceEditorStyle}
        wrapEnabled={true}
        readOnly={false}
        setOptions={aceOptions ?? { foldStyle: 'markbegin' }}
        value={source}
      />
      <Button
        style={{ marginTop: '10px' }}
        variant={ButtonVariant.secondary}
        onClick={handleTestConfig}
        isDisabled={loading || !isModified}
      >
        {t('Test Config')}
      </Button>{' '}
      {loading && <Spinner size="sm" />}
      {configResult && !isModified ? showResult() : ''}
    </div>
  );
};
