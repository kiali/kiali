import * as React from 'react';
import { Button, ButtonVariant, Modal, ModalVariant } from '@patternfly/react-core';
import { NamespaceInfo } from '../../types/NamespaceInfo';
import { ControlPlane } from '../../types/Mesh';
import { AuthorizationPolicy, Sidecar } from 'types/IstioObjects';
import { MessageType } from 'types/MessageCenter';
import { PromisesRegistry } from 'utils/CancelablePromises';
import { DurationInSeconds } from 'types/Common';
import { ConfigPreviewItem, IstioConfigPreview } from 'components/IstioConfigPreview/IstioConfigPreview';
import * as AlertUtils from 'utils/AlertUtils';
import * as API from 'services/Api';
import { GraphDataSource } from 'services/GraphDataSource';
import {
  buildGraphAuthorizationPolicy,
  buildNamespaceInjectionPatch,
  buildGraphSidecars
} from 'components/IstioWizards/WizardActions';
import { dicIstioTypeToGVK } from '../../types/IstioConfigList';
import { gvkToString } from '../../utils/IstioConfigUtils';

type OverviewTrafficPoliciesProps = {
  controlPlanes?: ControlPlane[];
  duration: DurationInSeconds;
  hideConfirmModal: () => void;
  isOpen: boolean;
  kind: string;
  load: () => void;
  nsInfo: NamespaceInfo;
  nsTarget: string;
  opTarget: string;
};

type State = {
  authorizationPolicies: AuthorizationPolicy[];
  confirmationModal: boolean;
  disableOp: boolean;
  loaded: boolean;
  selectedRevision: string;
  sidecars: Sidecar[];
};

export class OverviewTrafficPolicies extends React.Component<OverviewTrafficPoliciesProps, State> {
  private promises = new PromisesRegistry();

  constructor(props: OverviewTrafficPoliciesProps) {
    super(props);
    this.state = {
      confirmationModal: this.confirmationModalStatus(),
      authorizationPolicies: [],
      sidecars: [],
      loaded: this.props.opTarget === 'update',
      disableOp: true,
      selectedRevision: this.props.kind === 'canary' ? this.props.opTarget : ''
    };
  }

  confirmationModalStatus = (): boolean => {
    return this.props.kind === 'canary' || this.props.kind === 'injection';
  };

  componentDidUpdate(prevProps: OverviewTrafficPoliciesProps): void {
    if (prevProps.nsTarget !== this.props.nsTarget || prevProps.opTarget !== this.props.opTarget) {
      switch (this.props.kind) {
        case 'injection':
          this.fetchPermission(true);
          break;
        case 'canary':
          this.setState({ selectedRevision: this.props.opTarget }, () => this.fetchPermission(true));
          break;
        default:
          if (this.props.opTarget === 'create') {
            this.generateTrafficPolicies();
            this.fetchPermission();
          } else if (this.props.opTarget === 'update') {
            const authorizationPolicies =
              this.props.nsInfo?.istioConfig?.resources[gvkToString(dicIstioTypeToGVK['AuthorizationPolicy'])] ?? [];
            const sidecars = this.props.nsInfo?.istioConfig?.resources[gvkToString(dicIstioTypeToGVK['Sidecar'])] ?? [];
            const remove = ['uid', 'resourceVersion', 'generation', 'creationTimestamp', 'managedFields'];
            sidecars.map(sdc => remove.map(key => delete sdc.metadata[key]));
            authorizationPolicies.map(ap => remove.map(key => delete ap.metadata[key]));
            this.setState({ authorizationPolicies, sidecars }, () => this.fetchPermission());
          } else if (this.props.opTarget === 'delete') {
            const nsInfo = this.props.nsInfo.istioConfig;
            this.setState(
              {
                authorizationPolicies: nsInfo?.resources[gvkToString(dicIstioTypeToGVK['AuthorizationPolicy'])] ?? [],
                sidecars: nsInfo?.resources[gvkToString(dicIstioTypeToGVK['Sidecar'])] ?? []
              },
              () => this.fetchPermission(true)
            );
          }
          break;
      }
    }
  }

  fetchPermission = (
    confirmationModal = false,
    loaded: boolean = this.props.opTarget === 'update' || this.props.opTarget === 'create'
  ): void => {
    this.promises
      .register('namespacepermissions', API.getIstioPermissions([this.props.nsTarget], this.props.nsInfo.cluster))
      .then(result => {
        const permission = result.data[this.props.nsTarget][gvkToString(dicIstioTypeToGVK['AuthorizationPolicy'])];
        const disableOp = !(permission.create && permission.update && permission.delete);
        this.setState({
          confirmationModal,
          disableOp,
          loaded
        });
      });
  };

  generateTrafficPolicies = (): void => {
    const graphDataSource = new GraphDataSource();

    graphDataSource.on('fetchSuccess', () => {
      const aps = buildGraphAuthorizationPolicy(this.props.nsTarget, graphDataSource.graphDefinition);
      const scs = buildGraphSidecars(this.props.nsTarget, graphDataSource.graphDefinition);
      this.setState({ authorizationPolicies: aps, sidecars: scs });
    });

    graphDataSource.fetchForNamespace(this.props.duration, this.props.nsTarget);
  };

  onConfirm = (): void => {
    switch (this.props.kind) {
      case 'injection':
        this.onAddRemoveAutoInjection();
        break;
      case 'canary':
        this.onUpgradeDowngradeIstio();
        break;
      default:
        this.onAddRemoveTrafficPolicies();
        break;
    }

    this.onHideConfirmModal();
  };

  onAddRemoveAutoInjection = (): void => {
    const jsonPatch = buildNamespaceInjectionPatch(
      this.props.opTarget === 'enable',
      this.props.opTarget === 'remove',
      null
    );

    API.updateNamespace(this.props.nsTarget, jsonPatch, this.props.nsInfo.cluster)
      .then(_ => {
        AlertUtils.add(`Namespace ${this.props.nsTarget} updated`, 'default', MessageType.SUCCESS);
        this.props.load();
      })
      .catch(error => {
        AlertUtils.addError(`Could not update namespace ${this.props.nsTarget}`, error);
      });
  };

  onUpgradeDowngradeIstio = (): void => {
    const jsonPatch = buildNamespaceInjectionPatch(false, false, this.state.selectedRevision);

    API.updateNamespace(this.props.nsTarget, jsonPatch, this.props.nsInfo.cluster)
      .then(_ => {
        AlertUtils.add(`Namespace ${this.props.nsTarget} updated`, 'default', MessageType.SUCCESS);
        this.props.load();
      })
      .catch(error => {
        AlertUtils.addError(`Could not update namespace ${this.props.nsTarget}`, error);
      });
  };

  onAddRemoveTrafficPolicies = (): void => {
    const op = this.props.opTarget;
    const ns = this.props.nsTarget;
    const cluster = this.props.nsInfo?.cluster;
    const duration = this.props.duration;
    const apsP = this.state.authorizationPolicies;
    const sdsP = this.state.sidecars;

    if (op !== 'create') {
      this.promises
        .registerAll(
          'trafficPoliciesDelete',
          apsP
            .map(ap =>
              API.deleteIstioConfigDetail(ns, dicIstioTypeToGVK['AuthorizationPolicy'], ap.metadata.name, cluster)
            )
            .concat(
              sdsP.map(sc => API.deleteIstioConfigDetail(ns, dicIstioTypeToGVK['Sidecar'], sc.metadata.name, cluster))
            )
        )
        .then(_ => {
          //Error here
          if (op !== 'delete') {
            this.createTrafficPolicies(ns, duration, apsP, sdsP, op, cluster);
          } else {
            AlertUtils.add(`Traffic policies ${op}d for ${ns} namespace.`, 'default', MessageType.SUCCESS);
            this.props.load();
          }
        })
        .catch(errorDelete => {
          if (!errorDelete.isCanceled) {
            AlertUtils.addError('Could not delete traffic policies.', errorDelete);
          }
        });
    } else {
      this.createTrafficPolicies(ns, duration, apsP, sdsP, op, cluster);
    }
  };

  createTrafficPolicies = (
    ns: string,
    duration: DurationInSeconds,
    aps: AuthorizationPolicy[],
    sds: Sidecar[],
    op = 'create',
    cluster?: string
  ): void => {
    const graphDataSource = new GraphDataSource();

    graphDataSource.on('fetchSuccess', () => {
      this.promises
        .registerAll(
          'trafficPoliciesCreate',
          aps
            .map(ap =>
              API.createIstioConfigDetail(ns, dicIstioTypeToGVK['AuthorizationPolicy'], JSON.stringify(ap), cluster)
            )
            .concat(
              sds.map(sc => API.createIstioConfigDetail(ns, dicIstioTypeToGVK['Sidecar'], JSON.stringify(sc), cluster))
            )
        )
        .then(results => {
          if (results.length > 0) {
            AlertUtils.add(`Traffic policies ${op}d for ${ns} namespace.`, 'default', MessageType.SUCCESS);
          }

          this.props.load();
        })
        .catch(errorCreate => {
          if (!errorCreate.isCanceled) {
            AlertUtils.addError(`Could not ${op} traffic policies.`, errorCreate);
          }
        });
    });

    graphDataSource.on('fetchError', (errorMessage: string | null) => {
      if (errorMessage !== '') {
        errorMessage = `Could not fetch traffic data: ${errorMessage}`;
      } else {
        errorMessage = 'Could not fetch traffic data.';
      }

      AlertUtils.addError(errorMessage);
    });

    graphDataSource.fetchForNamespace(duration, ns);
  };

  getItemsPreview = (): ConfigPreviewItem[] => {
    const items: ConfigPreviewItem[] = [];

    this.state.authorizationPolicies.length > 0 &&
      items.push({
        objectGVK: dicIstioTypeToGVK['AuthorizationPolicy'],
        items: this.state.authorizationPolicies,
        title: 'Authorization Policies'
      });

    this.state.sidecars.length > 0 &&
      items.push({ objectGVK: dicIstioTypeToGVK['Sidecar'], items: this.state.sidecars, title: 'Sidecars' });

    return items;
  };

  onConfirmPreviewPoliciesModal = (items: ConfigPreviewItem[]): void => {
    const aps = items.filter(
      i => gvkToString(i.objectGVK) === gvkToString(dicIstioTypeToGVK['AuthorizationPolicy'])
    )[0];
    const sds = items.filter(i => gvkToString(i.objectGVK) === gvkToString(dicIstioTypeToGVK['Sidecar']))[0];

    this.setState(
      {
        authorizationPolicies: aps ? (aps.items as AuthorizationPolicy[]) : [],
        sidecars: sds ? (sds.items as Sidecar[]) : [],
        loaded: false
      },
      () => this.fetchPermission(true, false)
    );
  };

  onHideConfirmModal = (): void => {
    this.setState({ confirmationModal: false, sidecars: [], authorizationPolicies: [], loaded: false }, () =>
      this.props.hideConfirmModal()
    );
  };

  render(): React.ReactNode {
    const canaryVersion = this.props.kind === 'canary' ? this.props.opTarget : '';

    const modalAction =
      this.props.kind === 'canary'
        ? 'Switch'
        : this.props.opTarget.length > 0
        ? `${this.props.opTarget.charAt(0).toLocaleUpperCase()}${this.props.opTarget.slice(1)}`
        : '';

    const colorAction = ['enable', 'disable', 'create'].includes(this.props.opTarget)
      ? ButtonVariant.primary
      : ButtonVariant.danger;

    const title = `Confirm ${modalAction}${
      this.props.kind === 'policy'
        ? ' Traffic Policies'
        : this.props.kind === 'injection'
        ? ' Auto Injection'
        : ` to ${canaryVersion}`
    }?`;

    return (
      <>
        {this.state.loaded && (
          <IstioConfigPreview
            isOpen={
              this.props.isOpen &&
              this.props.kind === 'policy' &&
              this.props.opTarget !== 'delete' &&
              this.state.authorizationPolicies.length > 0
            }
            title={'Preview Traffic Policies'}
            downloadPrefix="trafficPolicies"
            disableAction={this.state.disableOp}
            onClose={this.onHideConfirmModal}
            onConfirm={this.onConfirmPreviewPoliciesModal}
            ns={this.props.nsTarget}
            items={this.getItemsPreview()}
            opTarget={this.props.opTarget}
          />
        )}

        <Modal
          variant={ModalVariant.small}
          title={title}
          isOpen={this.state.confirmationModal}
          onClose={this.onHideConfirmModal}
          actions={[
            <Button
              data-test="confirm-create"
              key="confirm"
              isDisabled={this.state.disableOp}
              variant={colorAction}
              onClick={this.onConfirm}
            >
              {modalAction}
            </Button>,

            <Button key="cancel" variant={ButtonVariant.secondary} onClick={this.onHideConfirmModal}>
              Cancel
            </Button>
          ]}
        >
          {this.props.kind === 'injection' ? (
            <>
              You're going to {this.props.opTarget} Auto Injection in the namespace {this.props.nsTarget}. Are you sure?
            </>
          ) : this.props.kind === 'canary' ? (
            <>
              You're going to switch to {this.state.selectedRevision} revision in the namespace {this.props.nsTarget}.
              Are you sure?
            </>
          ) : (
            <>
              Namespace {this.props.nsTarget} {this.props.opTarget === 'create' ? 'has not ' : 'has'} existing traffic
              policies objects. Do you want to {this.props.opTarget} them ?
            </>
          )}
          {}
        </Modal>
      </>
    );
  }
}
