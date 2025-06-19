import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Spinner, Tooltip, TooltipPosition } from '@patternfly/react-core';
import AceEditor from 'react-ace';
import { Theme } from '../../types/Common';
import { istioAceEditorStyle } from '../../styles/AceEditorStyle';
import { aceOptions, yamlDumpOptions } from '../../types/IstioConfigDetails';
import { getKialiTheme } from '../../utils/ThemeUtils';
import { dump, loadAll, YAMLException } from 'js-yaml';
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

export const TesterTracingConfig: React.FC<CheckModalProps> = (props: CheckModalProps) => {
  const { t } = useKialiTranslation();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isModified, setIsModified] = React.useState(false);
  const aceEditorRef = React.useRef<ReactAce | null>(null);
  const [source, setSource] = React.useState<string>(dump(props.configData, yamlDumpOptions));

  const theme = getKialiTheme();
  const [configResult, setConfigResult] = React.useState<string | null>(null);

  const parseYamlDocumentsSync = (yamlText: string): any => {
    let document: any;
    try {
      loadAll(yamlText, doc => {
        document = doc;
      });
    } catch (e) {
      if (e instanceof YAMLException) {
        setLoading(false);
        setError(e.message);
      }
    }
    return document;
  };

  const testConfig = (): void => {
    const objectModified = parseYamlDocumentsSync(source);
    if (!objectModified) {
      return;
    }
    setLoading(true);
    const jsonPatch = JSON.stringify(objectModified).replace(new RegExp('(,null)+]', 'g'), ']');
    API.testTracingConfig(jsonPatch)
      .then(response => {
        setLoading(false);
        setIsModified(false);
        if (response.data.error) {
          setError(response.data.error);
        } else {
          setConfigResult(response.data.message);
          setError(null);
        }
      })
      .catch(err => {
        setLoading(false);
        setError(err.response?.data?.error);
      });
  };

  const showResult = (): React.ReactElement => {
    let healthSeverity: ValidationTypes;

    if (error) {
      healthSeverity = ValidationTypes.Error;
    } else {
      healthSeverity = ValidationTypes.Correct;
    }

    return (
      <Tooltip
        aria-label={t('Health status')}
        position={TooltipPosition.right}
        enableFlip={true}
        content={<>{error ? error : t('Configuration returned valid results')}</>}
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
    setError(null);
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
        setOptions={aceOptions}
        value={source}
      />
      <Button
        style={{ marginTop: '10px', marginRight: '5px' }}
        variant={ButtonVariant.secondary}
        onClick={handleTestConfig}
        isDisabled={loading || !isModified}
      >
        {t('Test Configuration')}
      </Button>
      {loading && <Spinner size="sm" />}
      {(configResult && !isModified) || error ? showResult() : ''}
    </div>
  );
};
