import * as React from 'react';
import { connect } from 'react-redux';
import { Modal, Icon, Button, Alert } from 'patternfly-react';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { style } from 'typestyle';
import _ from 'lodash';
import beautify from 'json-beautify';

import authenticationConfig from '../../config/AuthenticationConfig';
import { serverConfig } from '../../config';
import { ComputedServerConfig } from '../../config/ServerConfig';
import { AuthConfig } from '../../types/Auth';
import { KialiAppState } from '../../store/Store';

enum CopyStatus {
  NOT_COPIED, // We haven't copied the current output
  COPIED, // Current output is in the clipboard
  OLD_COPY // We copied the prev output, but there are changes in the KialiAppState
}

type DebugInformationProps = {
  appState: KialiAppState;
};

type DebugInformationState = {
  show: boolean;
  copyStatus: CopyStatus;
};

const textAreaStyle = style({
  width: '100%',
  height: '200px',
  minHeight: '200px',
  resize: 'vertical'
});

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

export class DebugInformation extends React.PureComponent<DebugInformationProps, DebugInformationState> {
  private textareaRef;

  constructor(props: DebugInformationProps) {
    super(props);
    this.textareaRef = React.createRef();
    this.state = { show: false, copyStatus: CopyStatus.NOT_COPIED };
  }

  open = () => {
    this.setState({ show: true, copyStatus: CopyStatus.NOT_COPIED });
  };

  close = () => {
    this.setState({ show: false });
  };

  copyCallback = (_text: string, result: boolean) => {
    this.textareaRef.current.select();
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

  render() {
    const renderDebugInformation = _.memoize(() => {
      const debugInformation: DebugInformationData = {
        backendConfigs: {
          authenticationConfig: authenticationConfig,
          computedServerConfig: serverConfig
        },
        currentURL: window.location.href,
        reduxState: this.props.appState
      };
      return beautify(
        debugInformation,
        (key: string, value: any) => {
          // We have to patch some runtime properties  we don't want to serialize
          if (['cyRef', 'summaryTarget', 'token', 'username'].includes(key)) {
            return null;
          }
          return value;
        },
        2
      );
    });
    if (!this.state.show) {
      return null;
    }

    return (
      <Modal show={this.state.show} onHide={this.close}>
        <Modal.Header>
          <button className="close" onClick={this.close} aria-hidden="true" aria-label="Close">
            <Icon type="pf" name="close" />
          </button>
          <Modal.Title>Debug information</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {this.state.copyStatus === CopyStatus.COPIED && (
            <Alert type="success" onDismiss={this.hideAlert}>
              Debug information has been copied to your clipboard.
            </Alert>
          )}
          {this.state.copyStatus === CopyStatus.OLD_COPY && (
            <Alert type="warning" onDismiss={this.hideAlert}>
              Debug information was copied to your clipboard, but is outdated now. It could be caused by new data
              received by auto refresh timers.
            </Alert>
          )}
          <span>Please include this information when opening a bug.</span>
          <CopyToClipboard onCopy={this.copyCallback} text={renderDebugInformation()} options={copyToClipboardOptions}>
            <textarea
              ref={this.textareaRef}
              className={textAreaStyle}
              readOnly={true}
              value={renderDebugInformation()}
            />
          </CopyToClipboard>
        </Modal.Body>
        <Modal.Footer>
          <Button onClick={this.close}>Close</Button>
          <CopyToClipboard onCopy={this.copyCallback} text={renderDebugInformation()} options={copyToClipboardOptions}>
            <Button bsStyle="primary">Copy</Button>
          </CopyToClipboard>
        </Modal.Footer>
      </Modal>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  appState: state
});

const DebugInformationContainer = connect(
  mapStateToProps,
  null,
  null,
  { withRef: true }
)(DebugInformation);

export default DebugInformationContainer;
