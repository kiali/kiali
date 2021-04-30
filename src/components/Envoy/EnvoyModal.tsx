import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import * as React from 'react';
import {
  Button,
  ButtonVariant,
  EmptyState,
  EmptyStateIcon,
  EmptyStateVariant,
  Modal,
  Spinner,
  Tab,
  Tabs,
  Title,
  TooltipPosition
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
import { ISortBy, SortByDirection } from '@patternfly/react-table';
import Namespace from '../../types/Namespace';
import { KialiAppState } from '../../store/Store';
import { namespaceItemsSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { PFBadge, PFBadges } from '../Pf/PfBadges';

// Enables the search box for the ACEeditor
require('ace-builds/src-noconflict/ext-searchbox');

const resources: string[] = ['clusters', 'listeners', 'routes', 'bootstrap', 'all'];

type ReduxProps = {
  namespaces: Namespace[];
};

type EnvoyDetailProps = ReduxProps & {
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
  tableSortBy: ResourceSorts;
  envoyTabKey: number;
};

export type ResourceSorts = { [resource: string]: ISortBy };

export const Loading = () => (
  <EmptyState variant={EmptyStateVariant.full}>
    <EmptyStateIcon variant="container" component={Spinner} />
    <Title size="lg" headingLevel="h4">
      Loading...
    </Title>
  </EmptyState>
);

const iconStyle = style({
  display: 'inline-block',
  paddingTop: '5px'
});

class EnvoyDetailsModal extends React.Component<EnvoyDetailProps, EnvoyDetailState> {
  aceEditorRef: React.RefObject<AceEditor>;

  constructor(props: EnvoyDetailProps) {
    super(props);
    this.aceEditorRef = React.createRef();
    this.state = {
      config: {},
      fetch: false,
      pod: this.sortedPods()[0],
      resource: 'clusters',
      tableSortBy: {
        clusters: {
          index: 0,
          direction: 'asc'
        },
        listeners: {
          index: 0,
          direction: 'asc'
        },
        routes: {
          index: 0,
          direction: 'asc'
        }
      },
      envoyTabKey: 0
    };
  }

  componentDidMount() {
    this.fetchContent();
  }

  componentDidUpdate(_prevProps: EnvoyDetailProps, prevState: EnvoyDetailState) {
    if (
      this.state.fetch &&
      (this.state.pod.name !== prevState.pod.name || this.state.resource !== prevState.resource)
    ) {
      this.fetchContent();
    }
  }

  envoyHandleTabClick = (_event, tabIndex) => {
    const resourceIdx: number = +tabIndex;
    const targetResource: string = resources[resourceIdx];
    if (targetResource !== this.state.resource) {
      this.setState({
        config: {},
        fetch: true,
        resource: targetResource,
        envoyTabKey: tabIndex
      });
    }
  };

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

  onSort = (tab: string, index: number, direction: SortByDirection) => {
    if (this.state.tableSortBy[tab].index !== index || this.state.tableSortBy[tab].direction !== direction) {
      let tableSortBy = this.state.tableSortBy;
      tableSortBy[tab].index = index;
      tableSortBy[tab].direction = direction;
      this.setState({
        tableSortBy: tableSortBy
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
    const builder = SummaryTableBuilder(
      this.state.resource,
      this.state.config,
      this.state.tableSortBy,
      this.props.namespaces,
      this.props.namespace
    );
    const SummaryWriterComp = builder[0];
    const summaryWriter = builder[1];

    const innerTabContent = this.isLoadingConfig() ? (
      <Loading />
    ) : this.showEditor() ? (
      <div>
        <div style={{ marginBottom: '20px' }}>
          <div key="service-icon" className={iconStyle}>
            <PFBadge badge={PFBadges.Pod} position={TooltipPosition.top} />
          </div>
          <ToolbarDropdown
            id="envoy_pods_list"
            tooltip="Display envoy config for the selected pod"
            handleSelect={key => this.setPod(key)}
            value={this.state.pod.name}
            label={this.state.pod.name}
            options={this.props.workload.pods.map((pod: Pod) => pod.name).sort()}
          />
          <span style={{ float: 'right' }}>
            <CopyToClipboard onCopy={this.onCopyToClipboard} text={this.editorContent()}>
              <Button variant={ButtonVariant.link} isInline>
                <KialiIcon.Copy className={defaultIconStyle} />
              </Button>
            </CopyToClipboard>
          </span>
        </div>
        <AceEditor
          ref={this.aceEditorRef}
          mode="yaml"
          theme="eclipse"
          width={'100%'}
          className={'istio-ace-editor'}
          wrapEnabled={true}
          readOnly={true}
          setOptions={aceOptions || { foldStyle: 'markbegin' }}
          value={this.editorContent()}
        />
      </div>
    ) : (
      <SummaryWriterComp
        writer={summaryWriter}
        sortBy={this.state.tableSortBy[this.state.resource]}
        onSort={this.onSort}
        pod={this.state.pod.name}
        pods={this.props.workload.pods.map(pod => pod.name)}
        setPod={this.setPod}
      />
    );
    const tabContent = <div style={{ marginTop: '20px' }}>{innerTabContent}</div>;

    const tabs = resources.map((value, index) => {
      const title = value === 'all' ? 'Full Config Dump' : value.charAt(0).toUpperCase() + value.slice(1);
      return (
        <Tab key={'tab_' + title} eventKey={index} title={title}>
          {tabContent}
        </Tab>
      );
    });

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
        <Tabs isFilled={true} activeKey={this.state.envoyTabKey} onSelect={this.envoyHandleTabClick}>
          {tabs}
        </Tabs>
      </Modal>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => ({
  namespaces: namespaceItemsSelector(state)!
});

const EnvoyDetailsModalConnected = connect(mapStateToProps)(EnvoyDetailsModal);
export default EnvoyDetailsModalConnected;
