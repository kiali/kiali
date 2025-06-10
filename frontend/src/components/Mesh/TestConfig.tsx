import * as React from 'react';
import { useKialiTranslation } from '../../utils/I18nUtils';
import { Button, ButtonVariant, Popover, PopoverPosition } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import AceEditor from 'react-ace';
import { Theme } from '../../types/Common';
import { istioAceEditorStyle } from '../../styles/AceEditorStyle';
import { aceOptions, yamlDumpOptions } from '../../types/IstioConfigDetails';
import { helpStyle } from './TestModal';
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
      <span>
        {t('external_services.tracing configuration:')}{' '}
        <Popover
          data-test="check-status-help"
          position={PopoverPosition.auto}
          headerContent={
            <div>
              <span>Check Status</span>
            </div>
          }
          bodyContent={
            <>
              {t(
                'Check the usual ports for the tracing service and provide a subset of the tracing configuration based on the tracing services found for external_services.tracing.'
              )}
              <br />
              {t(
                'While the health check is based on whether the URL response returns an HTTP 200, the services check performs a more exhaustive verification by attempting to analyze if the traces response is correct. It is important that internal_url is defined, as it relies on this host to perform the checks. When in_cluster config is false, it will use the external_url'
              )}
            </>
          }
        >
          <KialiIcon.Help className={helpStyle} />
        </Popover>
      </span>
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
