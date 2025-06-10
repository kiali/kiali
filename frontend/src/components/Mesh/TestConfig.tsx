import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant } from '@patternfly/react-core';
import AceEditor from 'react-ace';
import { Theme } from '../../types/Common';
import { istioAceEditorStyle } from '../../styles/AceEditorStyle';
import { aceOptions, yamlDumpOptions } from '../../types/IstioConfigDetails';
import { getKialiTheme } from '../../utils/ThemeUtils';
import { dump } from 'js-yaml';
import ReactAce from 'react-ace/lib/ace';
import { TracingInfo } from '../../types/TracingInfo';

type CheckModalProps = {
  tracingInfo?: TracingInfo;
};

export const TestConfig: React.FC<CheckModalProps> = (props: CheckModalProps) => {
  const { t } = useKialiTranslation();
  const aceEditorRef = React.useRef<ReactAce | null>(null);

  const theme = getKialiTheme();

  const getConfigToString = dump(props.tracingInfo, {
    noRefs: true,
    skipInvalid: true,
    ...yamlDumpOptions
  });

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
      <Button style={{ marginTop: '10px' }} variant={ButtonVariant.secondary}>
        Test Config
      </Button>
    </div>
  );
};
