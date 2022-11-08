import * as React from 'react';
import { connect } from 'react-redux';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import _ from 'lodash';
import beautify from 'json-beautify';

import authenticationConfig from '../../config/AuthenticationConfig';
import { serverConfig } from '../../config';
import { ComputedServerConfig } from '../../config/ServerConfig';
import { AuthConfig } from '../../types/Auth';
import { KialiAppState } from '../../store/Store';
import {
  Alert,
  AlertActionCloseButton,
  AlertVariant,
  Button,
  ButtonVariant,
  Modal,
  ModalVariant
} from '@patternfly/react-core';
import {aceOptions} from "../../types/IstioConfigDetails";
import AceEditor from "react-ace";

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
  show: boolean;
  copyStatus: CopyStatus;
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

export class KialiConfiguration extends React.PureComponent<DebugInformationProps, DebugInformationState> {
  aceEditorRef: React.RefObject<AceEditor>;

  constructor(props: DebugInformationProps) {
    super(props);
    this.aceEditorRef = React.createRef();

    this.state = { show: false, copyStatus: CopyStatus.NOT_COPIED };
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

  renderHealthConfig = (config: Array<any> | Object | RegExp | string) => {
    if (Array.isArray(config)) {
      let arr = [];
      for (let v of config) {
        arr.push(this.renderHealthConfig(v) as never);
      }
      return arr;
    }
    let result = {};
    for (let [key, value] of Object.entries(config)) {
      if ((value as Object).constructor.toString().includes('RegExp')) {
        result[key] = (value as RegExp).toString();
      } else if (typeof value !== 'object') {
        result[key] = value;
      } else {
        result[key] = this.renderHealthConfig(value);
      }
    }
    return result;
  };

  render() {
    const parseConfig = (key: string, value: any) => {
      // We have to patch some runtime properties  we don't want to serialize
      if (['cyRef', 'summaryTarget', 'token', 'username'].includes(key)) {
        return null;
      }
      if ('healthConfig' === key) {
        return this.renderHealthConfig(value);
      }
      return value;
    };
    const renderDebugInformation = _.memoize(() => {
      const debugInformation: DebugInformationData = {
        backendConfigs: {
          authenticationConfig: authenticationConfig,
          computedServerConfig: serverConfig
        },
        currentURL: "",
        reduxState: this.props.appState
      };
      return beautify(debugInformation, parseConfig, 2);
    });

    if (!this.state.show) {
      return null;
    }

    return (
      <Modal
        variant={ModalVariant.small}
        isOpen={this.state.show}
        onClose={this.close}
        title="Kiali Configuration"
        actions={[
          <Button onClick={this.close}>Close</Button>,
          <CopyToClipboard onCopy={this.copyCallback} text={renderDebugInformation()} options={copyToClipboardOptions}>
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
        <span>Please include this information when opening a bug:</span>
        <CopyToClipboard onCopy={this.copyCallback} text={renderDebugInformation()} options={copyToClipboardOptions}>
          <AceEditor
            ref={this.aceEditorRef}
            mode="yaml"
            theme="eclipse"
            width={'100%'}
            //height={height.toString() + 'px'}
            className={'istio-ace-editor'}
            wrapEnabled={true}
            readOnly={true}
            setOptions={aceOptions || { foldStyle: 'markbegin' }}
            value={renderDebugInformation()}
          />
        </CopyToClipboard>
      </Modal>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  appState: state
});

const KialiConfigurationContainer = connect(mapStateToProps, null, null, { forwardRef: true })(KialiConfiguration);

export default KialiConfigurationContainer;
