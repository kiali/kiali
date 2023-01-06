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
import ParameterizedTabs from '../Tab/Tabs';
import { ICell, Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import { AuthConfig } from '../../types/Auth';
import authenticationConfig from '../../config/AuthenticationConfig';

enum CopyStatus {
  NOT_COPIED, // We haven't copied the current output
  COPIED, // Current output is in the clipboard
  OLD_COPY // We copied the prev output, but there are changes in the KialiAppState
}

type DebugInformationProps = {
  appState: KialiAppState;
  ref: React.RefObject<any>;
};

type DebugInformationState = {
  config: Object;
  copyStatus: CopyStatus;
  currentTab: string;
  show: boolean;
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
  'gatewayAPIEnabled',
  'istioConfigMap',
  'istioIdentityDomain',
  'istioNamespace',
  'istioStatusEnabled',
  'logLevel',
  'istioCanaryRevision',
  'istioInjectionAction'
];

const propsToPatch = ['cyRef', 'summaryTarget', 'token', 'username'];

const defaultTab = 'kialiConfig';

const tabIndex: { [tab: string]: number } = {
  kialiConfig: 0,
  additionalState: 1
};

export class DebugInformation extends React.PureComponent<DebugInformationProps, DebugInformationState> {
  aceEditorRef: React.RefObject<AceEditor>;
  kialiConfig = {};

  constructor(props: DebugInformationProps) {
    super(props);
    this.aceEditorRef = React.createRef();

    for (const key in serverConfig) {
      if (propsToShow.includes(key)) {
        if (typeof serverConfig[key] === 'string') {
          this.kialiConfig[key] = serverConfig[key];
        } else {
          this.kialiConfig[key] = JSON.stringify(serverConfig[key]);
        }
      }
    }
    // Order config items
    this.kialiConfig = Object.keys(this.kialiConfig)
      .sort()
      .reduce((obj, key) => {
        obj[key] = this.kialiConfig[key];
        return obj;
      }, {});

    this.state = { show: false, copyStatus: CopyStatus.NOT_COPIED, currentTab: defaultTab, config: this.kialiConfig };
  }

  open = () => {
    this.setState({ copyStatus: CopyStatus.NOT_COPIED, currentTab: defaultTab, show: true });
  };

  close = () => {
    this.setState({ show: false });
  };

  copyCallback = (_text: string, result: boolean) => {
    this.setState({ copyStatus: result ? CopyStatus.COPIED : CopyStatus.NOT_COPIED });
  };

  hideAlert = () => {
    this.setState({ copyStatus: CopyStatus.NOT_COPIED });
  };

  componentDidUpdate(prevProps: DebugInformationProps, _prevState: DebugInformationState) {
    if (this.props.appState !== prevProps.appState && this.state.copyStatus === CopyStatus.COPIED) {
      this.setState({ copyStatus: CopyStatus.OLD_COPY });
    }
  }

  parseConfig = (key: string, value: any) => {
    // We have to patch some runtime properties  we don't want to serialize
    if (propsToPatch.includes(key)) {
      return null;
    }
    return value;
  };

  // Properties shown in Kiali Config are not shown again in Additional State
  filterDebugInformation = (info: any) => {
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

  renderDebugInformation() {
    let debugInformation: DebugInformationData = {
      backendConfigs: {
        authenticationConfig: authenticationConfig,
        computedServerConfig: serverConfig
      },
      currentURL: window.location.href,
      reduxState: this.props.appState
    };
    debugInformation = this.filterDebugInformation(debugInformation);
    return beautify(debugInformation, this.parseConfig, 2);
  }

  private columns = (): ICell[] => {
    return [{ title: 'Configuration' }, { title: 'Value' }];
  };

  private getRows() {
    var conf: string[][] = [];

    for (const [k, v] of Object.entries(this.state.config)) {
      if (typeof v !== 'string') {
        conf.push([k, JSON.stringify(v)]);
      } else {
        conf.push([k, v]);
      }
    }
    return conf;
  }

  private renderTabs() {
    const kialiConfig = (
      <Tab eventKey={0} title="Kiali Config" key="kialiConfig">
        <span></span>

        <CopyToClipboard onCopy={this.copyCallback} text={this.getRows()} options={copyToClipboardOptions}>
          <Table header={<></>} variant={TableVariant.compact} cells={this.columns()} rows={this.getRows()}>
            <TableHeader />
            <TableBody />
          </Table>
        </CopyToClipboard>
      </Tab>
    );

    const additionalState = (
      <Tab eventKey={1} title="Additional State" key="additionalState">
        <span>Please include this information when opening a bug:</span>
        <CopyToClipboard
          onCopy={this.copyCallback}
          text={this.renderDebugInformation()}
          options={copyToClipboardOptions}
        >
          <AceEditor
            ref={this.aceEditorRef}
            mode="yaml"
            theme="eclipse"
            width={'100%'}
            className={'istio-ace-editor'}
            wrapEnabled={true}
            readOnly={true}
            setOptions={aceOptions || { foldStyle: 'markbegin' }}
            value={this.renderDebugInformation()}
          />
        </CopyToClipboard>
      </Tab>
    );

    const tabsArray: JSX.Element[] = [kialiConfig, additionalState];
    return tabsArray;
  }

  render() {
    if (!this.state.show) {
      return null;
    }

    return (
      <Modal
        variant={ModalVariant.small}
        isOpen={this.state.show}
        onClose={this.close}
        title="Debug information"
        actions={[
          <Button onClick={this.close}>Close</Button>,
          <CopyToClipboard
            onCopy={this.copyCallback}
            text={
              this.state.currentTab === 'kialiConfig'
                ? JSON.stringify(this.state.config, null, 2)
                : this.renderDebugInformation()
            }
            options={copyToClipboardOptions}
          >
            <Button variant={ButtonVariant.primary}>Copy</Button>
          </CopyToClipboard>
        ]}
      >
        {this.state.copyStatus === CopyStatus.COPIED && (
          <Alert
            style={{ marginBottom: '20px' }}
            title="Debug information has been copied to your clipboard."
            variant={AlertVariant.success}
            isInline={true}
            actionClose={<AlertActionCloseButton onClose={this.hideAlert} />}
          />
        )}
        {this.state.copyStatus === CopyStatus.OLD_COPY && (
          <Alert
            style={{ marginBottom: '20px' }}
            title="Debug information was copied to your clipboard, but is outdated now. It could be caused by new data received by auto refresh timers."
            variant={AlertVariant.warning}
            isInline={true}
            actionClose={<AlertActionCloseButton onClose={this.hideAlert} />}
          />
        )}
        <ParameterizedTabs
          id="basic-tabs"
          onSelect={tabValue => {
            this.setState({ currentTab: tabValue });
            this.hideAlert();
          }}
          tabMap={tabIndex}
          defaultTab={defaultTab}
          activeTab={this.state.currentTab}
          mountOnEnter={true}
          unmountOnExit={true}
        >
          {this.renderTabs()}
        </ParameterizedTabs>
      </Modal>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  appState: state
});

const DebugInformationContainer = connect(mapStateToProps, null, null, { forwardRef: true })(DebugInformation);

export default DebugInformationContainer;
