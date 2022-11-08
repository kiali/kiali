import * as React from 'react';
import { connect } from 'react-redux';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { serverConfig } from '../../config';
import { KialiAppState } from '../../store/Store';
import {
  Button,
  ButtonVariant,
  Modal,
  ModalVariant
} from '@patternfly/react-core';
import {ICell, Table, TableBody, TableHeader, TableVariant} from "@patternfly/react-table";

enum CopyStatus {
  NOT_COPIED, // We haven't copied the current output
  COPIED, // Current output is in the clipboard
  OLD_COPY // We copied the prev output, but there are changes in the KialiAppState
}

type DebugInformationState = {
  show: boolean;
  copyStatus: CopyStatus;
  config: Array<string>;
};

const copyToClipboardOptions = {
  message: 'We failed to automatically copy the text, please use: #{key}, Enter\t'
};

const propsToShow = ["clusters", "gatewayAPIEnabled", "istioConfigMap", "istioIdentityDomain"];

type Props = {
  ref: React.RefObject<any>;
}

export class KialiConfiguration extends React.Component<Props, DebugInformationState> {

  constructor(props: Props) {
    super(props);

    let showConfig = [];

    for (const key in serverConfig) {
      if (propsToShow.includes(key)) {
        // @ts-ignore
        showConfig.push(key)
      }
    }

    this.state = {
      show: false,
      copyStatus: CopyStatus.NOT_COPIED,
      config: showConfig
    };
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

  private columns = (): ICell[] => {
    return [{ title: 'Configuration' }, { title: 'Value' }];
  };

  render() {

    const config = this.state.config.map((k) => {
      if (typeof serverConfig[k] === "string") {
        return [k, serverConfig[k]]
      } else {
        return [k, JSON.stringify(serverConfig[k])]
      }

    });
    return (
      <Modal
        variant={ModalVariant.small}
        isOpen={this.state.show}
        onClose={this.close}
        title="Kiali Configuration"
        actions={[
          <Button onClick={this.close}>Close</Button>,
          <CopyToClipboard onCopy={this.copyCallback} text={this.state.config} options={copyToClipboardOptions}>
            <Button variant={ButtonVariant.primary}>Copy</Button>
          </CopyToClipboard>
        ]}
      >
        <div>

          <Table
            header={<></>}
            variant={TableVariant.compact}
            cells={this.columns()}
            rows={config}
          >
            <TableHeader />
            <TableBody />
          </Table>
        </div>
      </Modal>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  appState: state
});

const KialiConfigurationContainer = connect(mapStateToProps, null, null, { forwardRef: true })(KialiConfiguration);

export default KialiConfigurationContainer;
