import * as React from 'react';
import { connect } from 'react-redux';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import _ from 'lodash';
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
  ModalVariant, Tab
} from '@patternfly/react-core';
import {aceOptions} from "../../types/IstioConfigDetails";
import AceEditor from "react-ace";
import ParameterizedTabs, {activeTab} from "../Tab/Tabs";
import {ICell, Table, TableVariant, TableBody, TableHeader} from "@patternfly/react-table";

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
  currentTab: string;
  show: boolean;
  copyStatus: CopyStatus;
  config: Array<string>;
};

type DebugInformationData = {
  backendConfigs: {
    computedServerConfig: ComputedServerConfig;
  };
  currentURL: string;
  reduxState: KialiAppState;
};

const copyToClipboardOptions = {
  message: 'We failed to automatically copy the text, please use: #{key}, Enter\t'
};

const propsToShow = ["accesibleNamespaces", "authStrategy", "clusters", "gatewayAPIEnabled", "istioConfigMap", "istioIdentityDomain", "istioNamespace", "istioStatusEnabled", "logLevel"];

const tabName = 'tab';
const defaultTab = 'kialiConfig';

const tabIndex: { [tab: string]: number } = {
  kialiConfig: 0,
  additionalState: 1
};

export class DebugInformation extends React.PureComponent<DebugInformationProps, DebugInformationState> {
  aceEditorRef: React.RefObject<AceEditor>;
  showConfig = Array<string>();

  constructor(props: DebugInformationProps) {
    super(props);
    this.aceEditorRef = React.createRef();

    for (const key in serverConfig) {
      if (propsToShow.includes(key)) {
        this.showConfig.push(key)
      }
    }
    this.showConfig = this.showConfig.sort();
    this.state = { show: false, copyStatus: CopyStatus.NOT_COPIED, currentTab: activeTab(tabName, defaultTab), config: this.showConfig };
  }

  open = () => {
    this.setState({ show: true, copyStatus: CopyStatus.NOT_COPIED });
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
    if (['cyRef', 'summaryTarget', 'token', 'username'].includes(key)) {
      return null;
    }
    return value;
  };

  renderDebugInformation = _.memoize(() => {
    const debugInformation: DebugInformationData = {
      backendConfigs: {
        computedServerConfig: serverConfig
      },
      currentURL: window.location.href,
      reduxState: this.props.appState
    };
    return beautify(debugInformation, this.parseConfig, 2);
  });

  private columns = (): ICell[] => {
    return [{ title: 'Configuration' }, { title: 'Value' }];
  };

private getServerConfig() {
  const config = this.showConfig.map((k) => {
    if (typeof serverConfig[k] === "string") {
      return [k, serverConfig[k]]
    } else {
      return [k, JSON.stringify(serverConfig[k])]
    }
  });
  return config;
}

private renderTabs() {

  const kialiConfig = (
      <Tab eventKey={0} title="Kiali Config" key="kialiConfig">
        <span></span>

        <CopyToClipboard onCopy={this.copyCallback} text={this.getServerConfig()} options={copyToClipboardOptions}>
          <Table
            header={<></>}
            variant={TableVariant.compact}
            cells={this.columns()}
            rows={this.getServerConfig()}
          >
            <TableHeader />
            <TableBody />
          </Table>
        </CopyToClipboard>
      </Tab>
    );

    const additionalState = (
      <Tab eventKey={1} title="Additional State" key="additionalState">
        <span>Please include this information when opening a bug.</span>
        <CopyToClipboard onCopy={this.copyCallback} text={this.renderDebugInformation()} options={copyToClipboardOptions}>
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
          <CopyToClipboard onCopy={this.copyCallback} text={this.state.currentTab === "kialiConfig" ? this.getServerConfig() : this.renderDebugInformation()} options={copyToClipboardOptions}>
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
            this.hideAlert()
          }}
          tabMap={tabIndex}
          tabName={tabName}
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
