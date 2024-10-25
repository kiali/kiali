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
  GroupVersionKind,
  K8sGateway,
  K8sGRPCRoute,
  K8sHTTPRoute,
  K8sReferenceGrant,
  PeerAuthentication,
  Sidecar,
  VirtualService
} from 'types/IstioObjects';
import { CopyToClipboard } from 'react-copy-to-clipboard';
import { kialiStyle } from 'styles/StyleUtils';
import { KialiIcon } from '../../config/KialiIcon';
import { yamlDumpOptions } from '../../types/IstioConfigDetails';
import { EditResources } from './EditResources';
import { cloneDeep } from 'lodash';
import { PFColors } from '../Pf/PfColors';
import _ from 'lodash';
import { download } from 'utils/Common';
import { t } from 'utils/I18nUtils';
import { dump } from 'js-yaml';
import { getGVKTypeString } from '../../utils/IstioConfigUtils';

export type IstioConfigItem =
  | AuthorizationPolicy
  | Sidecar
  | DestinationRule
  | PeerAuthentication
  | Gateway
  | K8sGateway
  | K8sGRPCRoute
  | K8sHTTPRoute
  | K8sReferenceGrant
  | VirtualService;

export interface ConfigPreviewItem {
  items: IstioConfigItem[];
  objectGVK: GroupVersionKind;
  title: string;
}

interface Props {
  actions?: any;
  disableAction?: boolean;
  downloadPrefix: string;
  isOpen: boolean;
  items: ConfigPreviewItem[];
  ns: string;
  onClose: () => void;
  onConfirm: (items: ConfigPreviewItem[]) => void;
  onKeyPress?: (e: any) => void;
  opTarget: string;
  title: string;
}

interface State {
  copied: boolean;
  items: ConfigPreviewItem[];
  mainTab: string;
  modalOpen: boolean;
  newIstioPage: boolean;
}

const separator = '\n---\n\n';

const downloadButtonStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const iconStyle = kialiStyle({
  marginLeft: '0.25rem'
});

// From react-patternfly library (not exported in the library)
type TabElement = React.ReactElement<TabProps, React.JSXElementConstructor<TabProps>>;
type TabsChild = TabElement | boolean | null | undefined;

export class IstioConfigPreview extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const newIstioPage = window.location.pathname.split('/')[2] === 'istio';

    this.state = {
      copied: false,
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

  getPreviewYaml = (): string => {
    let previewYaml = '';

    this.state.items.forEach((obj: ConfigPreviewItem, index: number) => {
      previewYaml += obj.items.map(item => dump(item, yamlDumpOptions)).join(separator);

      if (index !== this.state.items.length - 1) {
        previewYaml += separator;
      }
    });

    return previewYaml;
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
    const gvks = _.uniq(list.map(item => item.objectGVK));

    const itemsGrouped: ConfigPreviewItem[] = gvks.map(gvk => {
      const filtered = list.filter(it => getGVKTypeString(it.objectGVK) === getGVKTypeString(gvk));
      const item: ConfigPreviewItem = { objectGVK: gvk, title: filtered[0].title, items: [] };
      filtered.map(f => item.items.push(f.items[0]));
      return item;
    });

    return itemsGrouped;
  };

  render(): React.ReactNode {
    return (
      <Modal
        width={'75%'}
        title={this.props.title}
        isOpen={this.state.modalOpen}
        onClose={this.props.onClose}
        onKeyDown={e => (this.props.onKeyPress ? this.props.onKeyPress(e) : {})}
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
                  {t(this.props.opTarget[0]?.toUpperCase() + this.props.opTarget?.substring(1))}
                </Button>,
                <Button key="cancel" variant={ButtonVariant.secondary} onClick={this.props.onClose}>
                  {t('Cancel')}
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
              <Tooltip
                content={<>{this.state.copied ? t('Copied') : t('Copy all resources')}</>}
                onTooltipHidden={() => this.setState({ copied: false })}
              >
                <CopyToClipboard text={this.getPreviewYaml()}>
                  <Button
                    variant={ButtonVariant.link}
                    aria-label={t('Copy')}
                    isInline
                    onClick={() => this.setState({ copied: true })}
                  >
                    <KialiIcon.Copy />
                    <span className={iconStyle}>{t('Copy')}</span>
                  </Button>
                </CopyToClipboard>
              </Tooltip>
            </ToolbarItem>
            <ToolbarItem>
              <Tooltip content={<>{t('Download all resources in a file')}</>}>
                <Button
                  variant={ButtonVariant.link}
                  isInline
                  aria-label={t('Download')}
                  className={downloadButtonStyle}
                  onClick={() => download(this.getPreviewYaml(), `${this.props.downloadPrefix}_${this.props.ns}.yaml`)}
                >
                  <KialiIcon.Download />
                  <span className={iconStyle}>{t('Download')}</span>
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
            {t('User does not have enough permission for this action.')}
          </div>
        )}
      </Modal>
    );
  }
}
