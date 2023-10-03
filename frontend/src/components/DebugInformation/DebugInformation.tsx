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
import { ICell } from '@patternfly/react-table';
import { Table, TableBody, TableHeader } from '@patternfly/react-table/deprecated';
import { AuthConfig } from '../../types/Auth';
import { authenticationConfig } from '../../config/AuthenticationConfig';
import { basicTabStyle } from 'styles/TabStyles';
import { istioAceEditorStyle } from 'styles/AceEditorStyle';
import { Theme } from 'types/Common';
import { kialiStyle } from 'styles/StyleUtils';
import ReactAce from 'react-ace/lib/ace';
import { classes } from 'typestyle';
import { usePreviousValue } from 'utils/ReactUtils';

enum CopyStatus {
  NOT_COPIED, // We haven't copied the current output
  COPIED, // Current output is in the clipboard
  OLD_COPY // We copied the prev output, but there are changes in the KialiAppState
}

type DebugInformationProps = {
  appState: KialiAppState;
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

const copyToClipboardOptions = {
  message: 'We failed to automatically copy the text, please use: #{key}, Enter\t'
};

// Will be shown in Kiali Config and hidden in Additional state
const propsToShow = [
  'accessibleNamespaces',
  'authStrategy',
  'clusters',
  'gatewayAPIClasses',
  'gatewayAPIEnabled',
  'istioConfigMap',
  'istioIdentityDomain',
  'istioNamespace',
  'istioStatusEnabled',
  'logLevel',
  'istioCanaryRevision',
  'istioAnnotationsAction',
  'istioInjectionAction'
];

const propsToPatch = ['cyRef', 'summaryTarget', 'token', 'username'];

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

const tableStyle = kialiStyle({
  tableLayout: 'fixed',
  $nest: {
    '& tr > *:first-child': {
      width: '30%'
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

  const copyCallback = (_text: string, result: boolean) => {
    setCopyStatus(result ? CopyStatus.COPIED : CopyStatus.NOT_COPIED);
  };

  const download = () => {
    const element = document.createElement('a');
    const file = new Blob([getCopyText()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `debug_${currentTab === 'kialiConfig' ? 'kiali_config' : 'additional_state'}.json`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  };

  const hideAlert = () => {
    setCopyStatus(CopyStatus.NOT_COPIED);
  };

  const parseConfig = (key: string, value: any) => {
    // We have to patch some runtime properties  we don't want to serialize
    if (propsToPatch.includes(key)) {
      return null;
    }
    return value;
  };

  // Properties shown in Kiali Config are not shown again in Additional State
  const filterDebugInformation = (info: any) => {
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

  const renderDebugInformation = () => {
    let debugInformation: DebugInformationData = {
      backendConfigs: {
        authenticationConfig: authenticationConfig,
        computedServerConfig: serverConfig
      },
      currentURL: window.location.href,
      reduxState: props.appState
    };
    debugInformation = filterDebugInformation(debugInformation);
    return beautify(debugInformation, parseConfig, 2);
  };

  const getCopyText = (): string => {
    const text = currentTab === 'kialiConfig' ? JSON.stringify(config, null, 2) : renderDebugInformation();
    return text;
  };

  const columns = (): ICell[] => {
    return [{ title: 'Configuration' }, { title: 'Value' }];
  };

  const getRows = () => {
    var conf: string[][] = [];

    for (const [k, v] of Object.entries(config)) {
      if (typeof v !== 'string') {
        conf.push([k, JSON.stringify(v)]);
      } else {
        conf.push([k, v]);
      }
    }
    return conf;
  };

  const renderTabs = () => {
    const kialiConfig = (
      <Tab eventKey={0} title="Kiali Config" key="kialiConfig">
        <CopyToClipboard onCopy={copyCallback} text={getRows()} options={copyToClipboardOptions}>
          <Table className={tableStyle} cells={columns()} rows={getRows()}>
            <TableHeader />
            <TableBody />
          </Table>
        </CopyToClipboard>
      </Tab>
    );

    const theme = props.appState.globalState.theme;

    const additionalState = (
      <Tab eventKey={1} title="Additional State" key="additionalState">
        <span>Please include this information when opening a bug:</span>
        <CopyToClipboard onCopy={copyCallback} text={renderDebugInformation()} options={copyToClipboardOptions}>
          <AceEditor
            ref={aceEditorRef}
            mode="yaml"
            theme={theme === Theme.DARK ? 'twilight' : 'eclipse'}
            width={'100%'}
            className={istioAceEditorStyle}
            wrapEnabled={true}
            readOnly={true}
            setOptions={aceOptions || { foldStyle: 'markbegin' }}
            value={renderDebugInformation()}
          />
        </CopyToClipboard>
      </Tab>
    );

    const tabsArray: JSX.Element[] = [kialiConfig, additionalState];
    return tabsArray;
  };

  if (!props.isOpen) {
    return null;
  }

  return (
    <Modal
      className={modalStyle}
      variant={ModalVariant.medium}
      isOpen={props.isOpen}
      onClose={props.onClose}
      title="Debug information"
      actions={[
        <Button onClick={close}>Close</Button>,
        <CopyToClipboard onCopy={copyCallback} text={getCopyText()} options={copyToClipboardOptions}>
          <Button variant={ButtonVariant.secondary}>Copy</Button>
        </CopyToClipboard>,
        <Button variant={ButtonVariant.secondary} onClick={download}>
          Download
        </Button>
      ]}
    >
      {copyStatus === CopyStatus.COPIED && (
        <Alert
          style={{ marginBottom: '20px' }}
          title="Debug information has been copied to your clipboard."
          variant={AlertVariant.success}
          isInline={true}
          actionClose={<AlertActionCloseButton onClose={hideAlert} />}
        />
      )}
      {copyStatus === CopyStatus.OLD_COPY && (
        <Alert
          style={{ marginBottom: '20px' }}
          title="Debug information was copied to your clipboard, but is outdated now. It could be caused by new data received by auto refresh timers."
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

const mapStateToProps = (state: KialiAppState) => ({
  appState: state
});

export const DebugInformation = connect(mapStateToProps)(DebugInformationComponent);
