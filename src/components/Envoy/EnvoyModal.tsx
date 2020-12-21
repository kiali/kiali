import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Card,
  EmptyState,
  EmptyStateIcon,
  EmptyStateVariant,
  GutterSize,
  Modal,
  Spinner,
  Stack,
  StackItem,
  Title,
  Toolbar,
  ToolbarGroup,
  ToolbarItem
} from '@patternfly/react-core';
import { Workload } from '../../types/Workload';
import { EnvoyProxyDump, Pod } from '../../types/IstioObjects';
import ToolbarDropdown from '../ToolbarDropdown/ToolbarDropdown';
import AceEditor from 'react-ace';
import { aceOptions } from '../../types/IstioConfigDetails';
import { style } from 'typestyle';
import { SummaryTableBuilder } from './tables/BaseTable';
import { defaultIconStyle, KialiIcon } from '../../config/KialiIcon';
import { CopyToClipboard } from 'react-copy-to-clipboard';

// Enables the search box for the ACEeditor
require('ace-builds/src-noconflict/ext-searchbox');

const resources: string[] = ['all', 'bootstrap', 'clusters', 'listeners', 'routes'];

const displayFlex = style({
  display: 'flex'
});

const toolbarSpace = style({
  marginLeft: '1em'
});

type EnvoyDetailProps = {
  show: boolean;
  namespace: string;
  workload: Workload;
  onClose: (changed?: boolean) => void;
};

type EnvoyDetailState = {
  config: EnvoyProxyDump;
  fetch: boolean;
  pod: Pod;
  resource: string;
};

export const Loading = () => (
  <EmptyState variant={EmptyStateVariant.full}>
    <EmptyStateIcon variant="container" component={Spinner} />
    <Title size="lg" headingLevel="h4">
      Loading...
    </Title>
  </EmptyState>
);

class EnvoyDetailsModal extends React.Component<EnvoyDetailProps, EnvoyDetailState> {
  aceEditorRef: React.RefObject<AceEditor>;

  constructor(props: EnvoyDetailProps) {
    super(props);
    this.aceEditorRef = React.createRef();
    this.state = {
      config: {},
      fetch: false,
      pod: this.sortedPods()[0],
      resource: 'all'
    };
  }

  componentDidMount() {
    this.fetchContent();
  }

  componentDidUpdate() {
    if (this.state.fetch) {
      this.fetchContent();
    }
  }

  sortedPods = (): Pod[] => {
    return this.props.workload.pods.sort((p1: Pod, p2: Pod) => (p1.name >= p2.name ? 1 : -1));
  };

  setPod = (podName: string) => {
    const podIdx: number = +podName;
    const targetPod: Pod = this.sortedPods()[podIdx];
    if (targetPod.name !== this.state.pod.name) {
      this.setState({
        config: {},
        fetch: true,
        pod: targetPod
      });
    }
  };

  setResource = (resource: string) => {
    const resourceIdx: number = +resource;
    const targetResource: string = resources[resourceIdx];
    if (targetResource !== this.state.resource) {
      this.setState({
        config: {},
        fetch: true,
        resource: targetResource
      });
    }
  };

  fetchContent = () => {
    if (this.state.resource === 'all') {
      this.fetchEnvoyProxy();
    } else {
      this.fetchEnvoyProxyResourceEntries();
    }
  };

  fetchEnvoyProxy = () => {
    API.getPodEnvoyProxy(this.props.namespace, this.state.pod.name)
      .then(resultEnvoyProxy => {
        this.setState({
          config: resultEnvoyProxy.data,
          fetch: false
        });
      })
      .catch(error => {
        this.props.onClose();
        AlertUtils.addError(`Could not fetch envoy config for ${this.state.pod.name}.`, error);
      });
  };

  fetchEnvoyProxyResourceEntries = () => {
    API.getPodEnvoyProxyResourceEntries(this.props.namespace, this.state.pod.name, this.state.resource)
      .then(resultEnvoyProxy => {
        this.setState({
          config: resultEnvoyProxy.data,
          fetch: false
        });
      })
      .catch(error => {
        this.props.onClose();
        AlertUtils.addError(
          `Could not fetch envoy config ${this.state.resource} entries for ${this.state.pod.name}.`,
          error
        );
      });
  };

  isLoadingConfig = () => {
    return Object.keys(this.state.config).length < 1;
  };

  showEditor = () => {
    return this.state.resource === 'all' || this.state.resource === 'bootstrap';
  };

  editorContent = () => JSON.stringify(this.state.config, null, '  ');

  onCopyToClipboard = (_text: string, _result: boolean) => {
    const editor = this.aceEditorRef.current!['editor'];
    if (editor) {
      editor.selectAll();
    }
  };

  render() {
    const builder = SummaryTableBuilder(this.state.resource, this.state.config);
    const SummaryWriterComp = builder[0];
    const summaryWriter = builder[1];

    return (
      <Modal
        width={'75%'}
        title={`Envoy config for ${this.props.workload.name}`}
        isOpen={this.props.show}
        onClose={this.props.onClose}
        actions={[
          <Button key="cancel" variant="secondary" onClick={() => this.props.onClose(false)}>
            Cancel
          </Button>
        ]}
      >
        <Stack gutter={GutterSize.sm}>
          <StackItem>
            <Toolbar key="envoy-toolbar">
              <ToolbarGroup>
                <ToolbarItem className={displayFlex}>
                  <ToolbarDropdown
                    id="envoy_pods_list"
                    nameDropdown={'Pod'}
                    tooltip="Display envoy config for the selected pod"
                    handleSelect={key => this.setPod(key)}
                    value={this.state.pod.name}
                    label={this.state.pod.name}
                    options={this.props.workload.pods.map((pod: Pod) => pod.name).sort()}
                  />
                </ToolbarItem>
                <ToolbarItem className={[displayFlex, toolbarSpace].join(' ')}>
                  <ToolbarDropdown
                    id="envoy_xds_list"
                    nameDropdown={'Resources'}
                    tooltip="Display the selected resources from the Envoy config"
                    handleSelect={key => this.setResource(key)}
                    value={this.state.resource}
                    label={this.state.resource}
                    options={resources}
                  />
                </ToolbarItem>
              </ToolbarGroup>
              <ToolbarGroup style={{ marginLeft: 'auto' }}>
                <ToolbarItem>
                  {this.showEditor() ? (
                    <CopyToClipboard onCopy={this.onCopyToClipboard} text={this.editorContent()}>
                      <Button variant={ButtonVariant.link} isInline>
                        <KialiIcon.Copy className={defaultIconStyle} />
                      </Button>
                    </CopyToClipboard>
                  ) : undefined}
                </ToolbarItem>
              </ToolbarGroup>
            </Toolbar>
          </StackItem>
          <StackItem>
            <Card style={{ height: '400px' }}>
              {this.isLoadingConfig() ? (
                <Loading />
              ) : this.showEditor() ? (
                <AceEditor
                  ref={this.aceEditorRef}
                  mode="yaml"
                  theme="eclipse"
                  height={'400px'}
                  width={'100%'}
                  className={'istio-ace-editor'}
                  wrapEnabled={true}
                  readOnly={true}
                  setOptions={aceOptions || { foldStyle: 'markbegin' }}
                  value={this.editorContent()}
                />
              ) : (
                <SummaryWriterComp writer={summaryWriter} />
              )}
            </Card>
          </StackItem>
        </Stack>
      </Modal>
    );
  }
}

export default EnvoyDetailsModal;
