import * as React from 'react';
import {
  Button,
  ButtonVariant,
  Modal,
  Tab,
  TabProps,
  Tabs,
  Toolbar,
  ToolbarGroup,
  ToolbarItem,
  Tooltip
} from '@patternfly/react-core';
import {
  AuthorizationPolicy,
  DestinationRule,
  Gateway,
  K8sGateway,
  K8sHTTPRoute,
  K8sReferenceGrant,
  PeerAuthentication,
  Sidecar,
  VirtualService
} from 'types/IstioObjects';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { safeDumpOptions } from '../../types/IstioConfigDetails';
import { jsYaml } from '../../types/AceValidations';
import { EditResources } from './EditResources';
import { cloneDeep } from 'lodash';
import { PFColors } from '../Pf/PfColors';
import _ from 'lodash';

export type IstioConfigItem =
  | AuthorizationPolicy
  | Sidecar
  | DestinationRule
  | PeerAuthentication
  | Gateway
  | K8sGateway
  | K8sHTTPRoute
  | K8sReferenceGrant
  | VirtualService;

export interface ConfigPreviewItem {
  items: IstioConfigItem[];
  title: string;
  type: string;
}

interface Props {
  actions?: any;
  disableAction?: boolean;
  isOpen: boolean;
  items: ConfigPreviewItem[];
  ns: string;
  onClose: () => void;
  onConfirm: (items: ConfigPreviewItem[]) => void;
  onKeyPress?: (e: any) => void;
  opTarget: string;
  title?: string;
}

interface State {
  items: ConfigPreviewItem[];
  mainTab: string;
  modalOpen: boolean;
  newIstioPage: boolean;
}

const separator = '\n---\n\n';

const iconStyle = kialiStyle({
  marginLeft: '6px'
});

// From react-patternfly library (not exported in the library)
type TabElement = React.ReactElement<TabProps, React.JSXElementConstructor<TabProps>>;
type TabsChild = TabElement | boolean | null | undefined;

export class IstioConfigPreview extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const newIstioPage = window.location.pathname.split('/')[2] === 'istio';
    this.state = {
      mainTab: this.props.items.length > 0 ? this.props.items[0].title.toLocaleLowerCase().replace(/\s/g, '') : '',
      newIstioPage: newIstioPage,
      items: cloneDeep(this.props.items),
      modalOpen: this.props.isOpen
    };
  }
  componentDidUpdate(prevProps: Props): void {
    if (!_.isEqual(prevProps.items, this.props.items) || prevProps.isOpen !== this.props.isOpen) {
      this.setStateValues(this.props.items);
    }
  }

  setStateValues = (items: ConfigPreviewItem[]): void => {
    this.setState({
      mainTab: items.length > 0 ? items[0].title.toLocaleLowerCase().replace(/\s/g, '') : '',
      items: cloneDeep(items),
      modalOpen: this.props.isOpen
    });
  };

  trafficToText = (): string => {
    let trafficPoliciesYaml = '';
    this.state.items.map(obj => {
      trafficPoliciesYaml += obj.items.map(item => jsYaml.safeDump(item, safeDumpOptions)).join(separator);
      trafficPoliciesYaml += separator;
      return undefined;
    });
    return trafficPoliciesYaml;
  };

  downloadTraffic = (): void => {
    const element = document.createElement('a');
    const file = new Blob([this.trafficToText()], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `trafficPolicies_${this.props.ns}.yaml`;
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  };

  onConfirm = (): void => {
    this.props.onConfirm(this.state.items);
    this.setStateValues([]);
  };

  editorChange = (object: IstioConfigItem, index: number, title: string): void => {
    const items = this.state.items;
    const ind = items.findIndex(it =>
      this.state.newIstioPage
        ? it.title === title && it.items.find(t => t.metadata.namespace === object.metadata.namespace)
        : it.title === title
    );
    const config = items[ind];
    config.items[
      this.state.newIstioPage
        ? config.items.findIndex(fi => fi.metadata.namespace === object.metadata.namespace)
        : index
    ] = object;
    items[ind] = config;
    this.setState({ items });
  };

  addResource = (item: ConfigPreviewItem): TabsChild => {
    const key = item.title.toLocaleLowerCase().replace(/\s/g, '');
    const filterItems =
      this.props.items.length > 0
        ? (this.state.newIstioPage ? this.groupItems(this.props.items) : this.props.items).filter(
            it => it.title === item.title
          )
        : [];
    const propItems = filterItems.length > 0 ? filterItems[0].items : [];
    return (
      <Tab eventKey={key} key={`${key}_tab_preview`} title={item.title}>
        <EditResources
          items={
            this.state.newIstioPage
              ? item.items.sort((a, b) => a.metadata.namespace!.localeCompare(b.metadata.namespace!))
              : item.items
          }
          orig={
            (this.state.newIstioPage
              ? propItems.sort((a, b) => a.metadata.namespace!.localeCompare(b.metadata.namespace!))
              : propItems) as IstioConfigItem[]
          }
          isIstioNew={this.state.newIstioPage}
          onChange={(obj, index) => this.editorChange(obj, index, item.title)}
        />
      </Tab>
    );
  };

  groupItems = (list: ConfigPreviewItem[] = this.state.items): ConfigPreviewItem[] => {
    const types = _.uniq(list.map(item => item.type));
    const itemsGrouped: ConfigPreviewItem[] = types.map(type => {
      const filtered = list.filter(it => it.type === type);
      const item: ConfigPreviewItem = { type: type, title: filtered[0].title, items: [] };
      filtered.map(f => item.items.push(f.items[0]));
      return item;
    });
    return itemsGrouped;
  };

  render(): React.ReactNode {
    return (
      <Modal
        width={'75%'}
        title={this.props.title ? this.props.title : 'Preview Traffic Policies '}
        isOpen={this.state.modalOpen}
        onClose={this.props.onClose}
        onKeyPress={e => (this.props.onKeyPress ? this.props.onKeyPress(e) : {})}
        actions={
          this.props.actions
            ? this.props.actions
            : [
                <Button
                  key={this.props.opTarget}
                  variant={this.props.opTarget === 'delete' ? 'danger' : 'primary'}
                  isDisabled={this.props.disableAction}
                  onClick={this.onConfirm}
                  data-test={this.props.opTarget}
                >
                  {this.props.opTarget && this.props.opTarget[0].toUpperCase() + this.props.opTarget.substr(1)}
                </Button>,
                <Button key="cancel" variant={ButtonVariant.secondary} onClick={this.props.onClose}>
                  Cancel
                </Button>
              ]
        }
      >
        <Toolbar>
          <ToolbarGroup
            className={kialiStyle({
              marginLeft: 'auto'
            })}
          >
            <ToolbarItem>
              <Tooltip content={<>Copy all resources</>}>
                <CopyToClipboard text={this.trafficToText()}>
                  <Button variant={ButtonVariant.link} aria-label="Copy" isInline>
                    <KialiIcon.Copy />
                    <span className={iconStyle}>Copy</span>
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>
            <ToolbarItem>
              <Tooltip content={<>Download all resources in a file</>}>
                <Button
                  variant={ButtonVariant.link}
                  isInline
                  aria-label="Download"
                  className={kialiStyle({ marginLeft: '0.5em' })}
                  onClick={() => this.downloadTraffic()}
                >
                  <KialiIcon.Download />
                  <span className={iconStyle}>Download</span>
                </Button>
              </Tooltip>
            </ToolbarItem>
          </ToolbarGroup>
        </Toolbar>

        {this.state.items.length > 0 && (
          <Tabs
            activeKey={this.state.mainTab}
            onSelect={(_, tab) => this.setState({ mainTab: String(tab) })}
            isFilled={true}
          >
            {(this.state.newIstioPage ? this.groupItems() : this.state.items).map(item => this.addResource(item))}
          </Tabs>
        )}
        {this.props.disableAction && (
          <div className={kialiStyle({ color: PFColors.Danger })}>
            User does not have enough permission for this action.
          </div>
        )}
      </Modal>
    );
  }
}
