import * as React from 'react';
import { connect } from 'react-redux';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import beautify from 'json-beautify';
import { serverConfig } from '../../config';
import { ComputedServerConfig } from '../../config/ServerConfig';
import { KialiAppState } from '../../store/Store';
import {
  Alert,
  AlertActionCloseButton,
  AlertVariant,
  Button,
  ButtonVariant,
  Modal,
  ModalVariant,
  Tab
} from '@patternfly/react-core';
import { aceOptions } from '../../types/IstioConfigDetails';
import AceEditor from 'react-ace';
import { ParameterizedTabs } from '../Tab/Tabs';
import { AuthConfig } from '../../types/Auth';
import { authenticationConfig } from '../../config/AuthenticationConfig';
import { basicTabStyle } from 'styles/TabStyles';
import { istioAceEditorStyle } from 'styles/AceEditorStyle';
import { Theme } from 'types/Common';
import { kialiStyle } from 'styles/StyleUtils';
import ReactAce from 'react-ace/lib/ace';
import { classes } from 'typestyle';
import { usePreviousValue } from 'utils/ReactUtils';
import { JsonTable } from 'components/Table/JsonTable';
import { useKialiTranslation } from 'utils/I18nUtils';
import { download } from 'utils/Common';

enum CopyStatus {
  NOT_COPIED, // We haven't copied the current output
  COPIED, // Current output is in the clipboard
  OLD_COPY // We copied the prev output, but there are changes in the KialiAppState
}

type ReduxProps = {
  appState: KialiAppState;
};

type DebugInformationProps = ReduxProps & {
  isOpen: boolean;
  onClose: () => void;
};

type DebugInformationData = {
  backendConfigs: {
    authenticationConfig: AuthConfig;
    computedServerConfig: ComputedServerConfig;
  };
  currentURL: string;
  reduxState: KialiAppState;
};

// Will be shown in Kiali Config and hidden in Additional state
const propsToShow = [
  'accessibleNamespaces',
  'authStrategy',
  'clusters',
  'gatewayAPIClasses',
  'gatewayAPIEnabled',
  'istioAnnotationsAction',
  'istioCanaryRevision',
  'istioConfigMap',
  'istioIdentityDomain',
  'istioInjectionAction',
  'istioNamespace',
  'istioStatusEnabled',
  'logLevel'
];

// This should include anything that can not be stringified to JSON
const propsToPatch = ['cyRef', 'summaryTarget', 'target', 'token', 'username'];

const defaultTab = 'kialiConfig';

const tabIndex: { [tab: string]: number } = {
  kialiConfig: 0,
  additionalState: 1
};

const modalStyle = kialiStyle({
  overflowY: 'hidden',
  $nest: {
    '& .pf-v5-c-tab-content': {
      height: '525px',
      overflowY: 'auto'
    }
  }
});

const tabStyle = kialiStyle({
  $nest: {
    '&& .pf-v5-c-tabs__list': {
      marginLeft: 0
    }
  }
});

const DebugInformationComponent: React.FC<DebugInformationProps> = (props: DebugInformationProps) => {
  const [config, setConfig] = React.useState({});
  const [copyStatus, setCopyStatus] = React.useState(CopyStatus.NOT_COPIED);
  const [currentTab, setCurrentTab] = React.useState(defaultTab);

  const aceEditorRef = React.useRef<ReactAce | null>(null);

  const { t } = useKialiTranslation();

  React.useEffect(() => {
    let kialiConfig = {};

    for (const key in serverConfig) {
      if (propsToShow.includes(key)) {
        if (typeof serverConfig[key] === 'string') {
          kialiConfig[key] = serverConfig[key];
        } else {
          kialiConfig[key] = JSON.stringify(serverConfig[key]);
        }
      }
    }
    // Order config items
    kialiConfig = Object.keys(kialiConfig)
      .sort()
      .reduce((obj, key) => {
        obj[key] = kialiConfig[key];
        return obj;
      }, {});

    setConfig(kialiConfig);
  }, []);

  const prevAppState = usePreviousValue(props.appState);

  React.useEffect(() => {
    if (prevAppState !== props.appState && copyStatus === CopyStatus.COPIED) {
      setCopyStatus(CopyStatus.OLD_COPY);
    }
  }, [prevAppState, props.appState, copyStatus]);

  React.useEffect(() => {
    if (props.isOpen) {
      setCopyStatus(CopyStatus.NOT_COPIED);
      setCurrentTab(defaultTab);
    }
  }, [props.isOpen]);

  const copyCallback = (_text: string, result: boolean): void => {
    setCopyStatus(result ? CopyStatus.COPIED : CopyStatus.NOT_COPIED);
  };

  const downloadFile = (): void => {
    const fileName = `debug_${currentTab === 'kialiConfig' ? 'kiali_config' : 'additional_state'}.json`;

    download(copyText, fileName);
  };

  const hideAlert = (): void => {
    setCopyStatus(CopyStatus.NOT_COPIED);
  };

  const parseConfig = (key: string, value: string): string | null => {
    // We have to patch some runtime properties  we don't want to serialize
    if (propsToPatch.includes(key)) {
      return null;
    }

    return value;
  };

  // Properties shown in Kiali Config are not shown again in Additional State
  const filterDebugInformation = (info: DebugInformationData): DebugInformationData => {
    if (info !== null) {
      for (const [key] of Object.entries(info)) {
        if (propsToShow.includes(key)) {
          delete info[key];
          continue;
        }
      }
    }

    return info;
  };

  if (!props.isOpen) {
    return null;
  }

  let debugInformation: DebugInformationData = {
    backendConfigs: {
      authenticationConfig: authenticationConfig,
      computedServerConfig: serverConfig
    },
    currentURL: window.location.href,
    reduxState: props.appState
  };

  debugInformation = filterDebugInformation(debugInformation);

  const debugInformationText = beautify(debugInformation, parseConfig, 2);

  const copyText = currentTab === 'kialiConfig' ? JSON.stringify(config, null, 2) : debugInformationText;

  const renderTabs = (): React.ReactNode[] => {
    const kialiConfig = (
      <Tab eventKey={0} title={t('Kiali Config')} key="kialiConfig">
        <JsonTable label={t('Debug Information')} jsonData={config} width="30%" />
      </Tab>
    );

    const theme = props.appState.globalState.theme;

    const additionalState = (
      <Tab eventKey={1} title={t('Additional State')} key="additionalState">
        <span>{t('Please include this information when opening a bug:')}</span>
        <AceEditor
          ref={aceEditorRef}
          mode="yaml"
          theme={theme === Theme.DARK ? 'twilight' : 'eclipse'}
          width="100%"
          className={istioAceEditorStyle}
          wrapEnabled={true}
          readOnly={true}
          setOptions={aceOptions ?? { foldStyle: 'markbegin' }}
          value={debugInformationText}
        />
      </Tab>
    );

    return [kialiConfig, additionalState];
  };

  return (
    <Modal
      className={modalStyle}
      variant={ModalVariant.medium}
      isOpen={props.isOpen}
      onClose={props.onClose}
      title={t('Debug information')}
      actions={[
        <Button key="close" onClick={props.onClose}>
          {t('Close')}
        </Button>,

        <CopyToClipboard key="copy" onCopy={copyCallback} text={copyText}>
          <Button variant={ButtonVariant.secondary}>{t('Copy')}</Button>
        </CopyToClipboard>,

        <Button key="download" variant={ButtonVariant.secondary} onClick={downloadFile}>
          {t('Download')}
        </Button>
      ]}
    >
      {copyStatus === CopyStatus.COPIED && (
        <Alert
          style={{ marginBottom: '20px' }}
          title={t('Debug information has been copied to your clipboard.')}
          variant={AlertVariant.success}
          isInline={true}
          actionClose={<AlertActionCloseButton onClose={hideAlert} />}
        />
      )}

      {copyStatus === CopyStatus.OLD_COPY && (
        <Alert
          style={{ marginBottom: '20px' }}
          title={t(
            'Debug information was copied to your clipboard, but is outdated now. It could be caused by new data received by auto refresh timers.'
          )}
          variant={AlertVariant.warning}
          isInline={true}
          actionClose={<AlertActionCloseButton onClose={hideAlert} />}
        />
      )}

      <ParameterizedTabs
        id="basic-tabs"
        className={classes(basicTabStyle, tabStyle)}
        onSelect={tabValue => {
          setCurrentTab(tabValue);
          hideAlert();
        }}
        tabMap={tabIndex}
        defaultTab={defaultTab}
        activeTab={currentTab}
        mountOnEnter={true}
        unmountOnExit={true}
      >
        {renderTabs()}
      </ParameterizedTabs>
    </Modal>
  );
};

const mapStateToProps = (state: KialiAppState): ReduxProps => ({
  appState: state
});

export const DebugInformation = connect(mapStateToProps)(DebugInformationComponent);
