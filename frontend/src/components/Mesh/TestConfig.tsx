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
  const aceEditorRef = React.useRef<ReactAce | null>(null);
  const [source, setSource] = React.useState<string>(dump(props.configData, yamlDumpOptions));

  const theme = getKialiTheme();
  const [configResult] = React.useState<string | null>(null);

  const parseYamlDocumentsSync = (yamlText: string): any[] => {
    const documents: any[] = [];
    loadAll(yamlText, doc => {
      documents.push(doc);
    });
    return documents;
  };

  const testConfig = (): void => {
    const objectModified = parseYamlDocumentsSync(source);
    setLoading(true);
    const jsonPatch = JSON.stringify(objectModified).replace(new RegExp('(,null)+]', 'g'), ']');
    API.testTracingConfig(jsonPatch)
      .then(response => {
        setSource(dump(props.configData, yamlDumpOptions));
        setLoading(false);
        console.log(response);
      })
      .catch(err => {
        setLoading(false);
        setError(err.response.data.error);
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
        {t('Test Config')}
      </Button>
      {loading && <Spinner size="sm" />}
      {(configResult && !isModified) || error ? showResult() : ''}
    </div>
  );
};
