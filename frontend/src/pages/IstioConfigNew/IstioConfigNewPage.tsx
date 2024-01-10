import * as React from 'react';
import { KialiAppState } from '../../store/Store';
import { activeClustersSelector, activeNamespacesSelector, namespacesPerClusterSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import { Namespace } from '../../types/Namespace';
import { MeshCluster } from '../../types/Mesh';
import {
  ActionGroup,
  Button,
  ButtonVariant,
  Form,
  FormGroup,
  FormHelperText,
  HelperText,
  HelperTextItem,
  TextInput
} from '@patternfly/react-core';
import { RenderContent } from '../../components/Nav/Page';
import { kialiStyle } from 'styles/StyleUtils';
import { GatewayForm, GATEWAY, GATEWAYS, GatewayState, initGateway, isGatewayStateValid } from './GatewayForm';
import {
  K8sGatewayForm,
  K8SGATEWAY,
  K8SGATEWAYS,
  K8sGatewayState,
  initK8sGateway,
  isK8sGatewayStateValid
} from './K8sGatewayForm';
import {
  K8sReferenceGrantForm,
  K8SREFERENCEGRANT,
  K8SREFERENCEGRANTS,
  K8sReferenceGrantState,
  initK8sReferenceGrant,
  isK8sReferenceGrantStateValid
} from './K8sReferenceGrantForm';
import { SidecarForm, initSidecar, isSidecarStateValid, SIDECAR, SIDECARS, SidecarState } from './SidecarForm';
import { Paths, serverConfig } from '../../config';
import { KialiIcon } from '../../config/KialiIcon';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import * as API from '../../services/Api';
import { IstioPermissions } from '../../types/IstioConfigDetails';
import * as AlertUtils from '../../utils/AlertUtils';
import { history } from '../../app/History';
import {
  buildAuthorizationPolicy,
  buildGateway,
  buildK8sGateway,
  buildK8sReferenceGrant,
  buildPeerAuthentication,
  buildRequestAuthentication,
  buildServiceEntry,
  buildSidecar
} from '../../components/IstioWizards/WizardActions';
import { MessageType } from '../../types/MessageCenter';
import {
  AuthorizationPolicyForm,
  AUTHORIZACION_POLICY,
  AUTHORIZATION_POLICIES,
  AuthorizationPolicyState,
  initAuthorizationPolicy,
  isAuthorizationPolicyStateValid
} from './AuthorizationPolicyForm';
import {
  PeerAuthenticationForm,
  initPeerAuthentication,
  isPeerAuthenticationStateValid,
  PEER_AUTHENTICATION,
  PEER_AUTHENTICATIONS,
  PeerAuthenticationState
} from './PeerAuthenticationForm';
import {
  RequestAuthenticationForm,
  initRequestAuthentication,
  isRequestAuthenticationStateValid,
  REQUEST_AUTHENTICATION,
  REQUEST_AUTHENTICATIONS,
  RequestAuthenticationState
} from './RequestAuthenticationForm';
import { isValidK8SName } from '../../helpers/ValidationHelpers';
import { DefaultSecondaryMasthead } from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import {
  ServiceEntryForm,
  initServiceEntry,
  isServiceEntryValid,
  SERVICE_ENTRIES,
  SERVICE_ENTRY,
  ServiceEntryState
} from './ServiceEntryForm';
import { ConfigPreviewItem, IstioConfigPreview } from 'components/IstioConfigPreview/IstioConfigPreview';
import { isValid } from 'utils/Common';
import { ClusterDropdown } from './ClusterDropdown';
import { NamespaceDropdown } from '../../components/NamespaceDropdown';
import { Labels } from '../../components/Label/Labels';
import { WizardLabels } from '../../components/IstioWizards/WizardLabels';

type Props = {
  activeClusters: MeshCluster[];
  activeNamespaces: Namespace[];
  namespacesPerCluster?: Map<string, string[]>;
  objectType: string;
};

type State = {
  annotations: { [key: string]: string };
  authorizationPolicy: AuthorizationPolicyState;
  gateway: GatewayState;
  istioPermissions: IstioPermissions;
  itemsPreview: ConfigPreviewItem[];
  k8sGateway: K8sGatewayState;
  k8sReferenceGrant: K8sReferenceGrantState;
  labels: { [key: string]: string };
  name: string;
  peerAuthentication: PeerAuthenticationState;
  requestAuthentication: RequestAuthenticationState;
  serviceEntry: ServiceEntryState;
  showAnnotationsWizard: boolean;
  showLabelsWizard: boolean;
  showPreview: boolean;
  sidecar: SidecarState;
};

const formPadding = kialiStyle({ padding: '30px 20px 30px 20px' });

const editIcon = kialiStyle({
  marginLeft: '0.25rem',
  marginBottom: '0.20rem'
});

const editButton = kialiStyle({
  marginLeft: '0.5rem',
  display: 'flex',
  alignItems: 'center'
});

const editStyle = kialiStyle({
  display: 'flex',
  paddingTop: '0.25rem'
});

const DIC = {
  AuthorizationPolicy: AUTHORIZATION_POLICIES,
  Gateway: GATEWAYS,
  K8sGateway: K8SGATEWAYS,
  K8sReferenceGrant: K8SREFERENCEGRANTS,
  PeerAuthentication: PEER_AUTHENTICATIONS,
  RequestAuthentication: REQUEST_AUTHENTICATIONS,
  ServiceEntry: SERVICE_ENTRIES,
  Sidecar: SIDECARS
};

// Used in the Istio Config list Actions
export const NEW_ISTIO_RESOURCE = [
  { value: AUTHORIZACION_POLICY, label: AUTHORIZACION_POLICY, disabled: false },
  { value: GATEWAY, label: GATEWAY, disabled: false },
  { value: K8SGATEWAY, label: K8SGATEWAY, disabled: false },
  { value: K8SREFERENCEGRANT, label: K8SREFERENCEGRANT, disabled: false },
  { value: PEER_AUTHENTICATION, label: PEER_AUTHENTICATION, disabled: false },
  { value: REQUEST_AUTHENTICATION, label: REQUEST_AUTHENTICATION, disabled: false },
  { value: SERVICE_ENTRY, label: SERVICE_ENTRY, disabled: false },
  { value: SIDECAR, label: SIDECAR, disabled: false }
];

const initState = (): State => ({
  annotations: {},
  name: '',
  istioPermissions: {},
  labels: {},
  showAnnotationsWizard: false,
  showLabelsWizard: false,
  showPreview: false,
  itemsPreview: [],
  authorizationPolicy: initAuthorizationPolicy(),
  gateway: initGateway(),
  k8sGateway: initK8sGateway(),
  k8sReferenceGrant: initK8sReferenceGrant(),
  peerAuthentication: initPeerAuthentication(),
  requestAuthentication: initRequestAuthentication(),
  serviceEntry: initServiceEntry(),
  // Init with the istio-system/* for sidecar
  sidecar: initSidecar(`${serverConfig.istioNamespace}/*`)
});

class IstioConfigNewPageComponent extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  constructor(props: Props) {
    super(props);
    this.state = initState();
  }

  componentWillUnmount(): void {
    this.promises.cancelAll();
  }

  componentDidMount(): void {
    // Init component state
    this.setState(Object.assign({}, initState));
    this.fetchPermissions();
  }

  componentDidUpdate(prevProps: Props, _prevState: State): void {
    if (
      prevProps.activeNamespaces !== this.props.activeNamespaces ||
      prevProps.activeClusters !== this.props.activeClusters
    ) {
      this.fetchPermissions();
    }
  }

  canCreate = (namespace: string): boolean => {
    return (
      this.state.istioPermissions[namespace] &&
      this.props.objectType.length > 0 &&
      this.state.istioPermissions[namespace][DIC[this.props.objectType]].create
    );
  };

  isNamespaceInCluster = (namespace: string, cluster: string): boolean => {
    return (
      this.props.namespacesPerCluster !== undefined &&
      this.props.namespacesPerCluster.has(cluster) &&
      this.props.namespacesPerCluster.get(cluster)!.includes(namespace)
    );
  };

  fetchPermissions = (): void => {
    if (this.props.activeClusters.length > 0) {
      this.props.activeClusters.forEach(cluster => {
        this.fetchPermissionsForCluster(cluster.name);
      });
    } else {
      this.fetchPermissionsForCluster();
    }
  };

  fetchPermissionsForCluster = (cluster?: string): void => {
    if (this.props.activeNamespaces.length > 0) {
      this.promises
        .register(
          `permissions${cluster}`,
          API.getIstioPermissions(
            this.props.activeNamespaces.map(n => n.name),
            cluster
          )
        )
        .then(permResponse => {
          this.setState(
            {
              istioPermissions: permResponse.data
            },
            () => {
              this.props.activeNamespaces.forEach(ns => {
                if (!this.canCreate(ns.name)) {
                  AlertUtils.addWarning(
                    `User does not have permission to create Istio Config on namespace: ${ns.name}${
                      cluster ? ` in cluster ${cluster}` : ''
                    }`
                  );
                }
                if (cluster && !this.isNamespaceInCluster(ns.name, cluster)) {
                  AlertUtils.addInfo(`Namespace: ${ns.name} is not found in cluster ${cluster}`);
                }
              });
            }
          );
        })
        .catch(error => {
          // Canceled errors are expected on this query when page is unmounted
          if (!error.isCanceled) {
            AlertUtils.addError('Could not fetch Permissions.', error);
          }
        });
    }
  };

  onNameChange = (_event, value): void => {
    this.setState({
      name: value
    });
  };

  onLabelsWizardToggle = (value: boolean): void => {
    this.setState({
      showLabelsWizard: value
    });
  };

  onAddLabels = (value: { [key: string]: string }): void => {
    this.setState({
      labels: value,
      showLabelsWizard: false
    });
  };

  onAnnotationsWizardToggle = (value: boolean): void => {
    this.setState({
      showAnnotationsWizard: value
    });
  };

  onAddAnnotations = (value: { [key: string]: string }): void => {
    this.setState({
      annotations: value,
      showAnnotationsWizard: false
    });
  };

  onIstioResourceCreate = (): void => {
    if (this.props.activeClusters.length > 0) {
      this.props.activeClusters.forEach(cluster => {
        this.onIstioResourceCreateForCluster(cluster.name);
      });
    } else {
      this.onIstioResourceCreateForCluster();
    }
  };

  onIstioResourceCreateForCluster = async (cluster?: string): Promise<void> => {
    const jsonIstioObjects: { json: string; namespace: string }[] = this.state.itemsPreview.map(item => ({
      json: JSON.stringify(item.items[0]),
      namespace: item.items[0].metadata.namespace || ''
    }));
    let err = 0;
    await Promise.all(
      jsonIstioObjects
        .map(o => API.createIstioConfigDetail(o.namespace, DIC[this.props.objectType], o.json, cluster))
        .map(p =>
          p.catch(error => {
            // ignore 404 errors besides no CRD found ones
            if (
              error.response.status !== 404 ||
              API.getErrorString(error).includes('the server could not find the requested resource')
            ) {
              AlertUtils.addError(
                `Could not create Istio ${this.props.objectType} objects${cluster ? ` in cluster ${cluster}.` : '.'}`,
                error
              );
              err++;
            }
          })
        )
    ).then(results => {
      if (results.filter(value => value !== undefined).length > 0) {
        AlertUtils.add(
          `Istio ${this.props.objectType} created${cluster ? ` in cluster ${cluster}` : ''}`,
          'default',
          MessageType.SUCCESS
        );
      }
    });

    if (err === 0) {
      this.backToList();
    }
  };

  showPreview = (): void => {
    const items: ConfigPreviewItem[] = [];
    this.props.activeNamespaces.forEach(ns => {
      switch (this.props.objectType) {
        case AUTHORIZACION_POLICY:
          items.push({
            title: 'Authorization Policy',
            type: 'authorizationpolicy',
            items: [
              buildAuthorizationPolicy(
                this.state.annotations,
                this.state.labels,
                this.state.name,
                ns.name,
                this.state.authorizationPolicy
              )
            ]
          });
          break;
        case GATEWAY:
          items.push({
            title: 'Gateway',
            type: 'gateway',
            items: [
              buildGateway(this.state.annotations, this.state.labels, this.state.name, ns.name, this.state.gateway)
            ]
          });
          break;
        case K8SGATEWAY:
          items.push({
            title: 'K8sGateway',
            type: 'k8sGateway',
            items: [
              buildK8sGateway(
                this.state.annotations,
                this.state.labels,
                this.state.name,
                ns.name,
                this.state.k8sGateway
              )
            ]
          });
          break;
        case K8SREFERENCEGRANT:
          items.push({
            title: 'K8sReferenceGrant',
            type: 'k8sReferenceGrant',
            items: [
              buildK8sReferenceGrant(
                this.state.annotations,
                this.state.labels,
                this.state.name,
                ns.name,
                this.state.k8sReferenceGrant
              )
            ]
          });
          break;
        case PEER_AUTHENTICATION:
          items.push({
            title: 'Peer Authentication',
            type: 'peerauthentication',
            items: [
              buildPeerAuthentication(
                this.state.annotations,
                this.state.labels,
                this.state.name,
                ns.name,
                this.state.peerAuthentication
              )
            ]
          });
          break;
        case REQUEST_AUTHENTICATION:
          items.push({
            title: 'Request Authentication',
            type: 'requestauthentication',
            items: [
              buildRequestAuthentication(
                this.state.annotations,
                this.state.labels,
                this.state.name,
                ns.name,
                this.state.requestAuthentication
              )
            ]
          });
          break;
        case SERVICE_ENTRY:
          items.push({
            title: 'Service Entry',
            type: 'serviceentry',
            items: [
              buildServiceEntry(
                this.state.annotations,
                this.state.labels,
                this.state.name,
                ns.name,
                this.state.serviceEntry
              )
            ]
          });
          break;
        case SIDECAR:
          items.push({
            title: 'Sidecar',
            type: 'sidecar',
            items: [
              buildSidecar(this.state.annotations, this.state.labels, this.state.name, ns.name, this.state.sidecar)
            ]
          });
          break;
      }
    });
    this.setState({ itemsPreview: items, showPreview: true });
    //this.onIstioResourceCreate()
  };

  backToList = (): void => {
    this.setState(initState(), () => {
      // Back to list page
      history.push(`/${Paths.ISTIO}?namespaces=${this.props.activeNamespaces.map(n => n.name).join(',')}`);
    });
  };

  isIstioFormValid = (): boolean => {
    switch (this.props.objectType) {
      case AUTHORIZACION_POLICY:
        return isAuthorizationPolicyStateValid(this.state.authorizationPolicy);
      case GATEWAY:
        return isGatewayStateValid(this.state.gateway);
      case K8SGATEWAY:
        return isK8sGatewayStateValid(this.state.k8sGateway);
      case K8SREFERENCEGRANT:
        return isK8sReferenceGrantStateValid(this.state.k8sReferenceGrant);
      case PEER_AUTHENTICATION:
        return isPeerAuthenticationStateValid(this.state.peerAuthentication);
      case REQUEST_AUTHENTICATION:
        return isRequestAuthenticationStateValid(this.state.requestAuthentication);
      case SERVICE_ENTRY:
        return isServiceEntryValid(this.state.serviceEntry);
      case SIDECAR:
        return isSidecarStateValid(this.state.sidecar);
      default:
        return false;
    }
  };

  onChangeAuthorizationPolicy = (authorizationPolicy: AuthorizationPolicyState): void => {
    this.setState(prevState => {
      Object.keys(prevState.authorizationPolicy).forEach(
        key => (prevState.authorizationPolicy[key] = authorizationPolicy[key])
      );
      return {
        authorizationPolicy: prevState.authorizationPolicy
      };
    });
  };

  onChangeGateway = (gateway: GatewayState): void => {
    this.setState(prevState => {
      Object.keys(prevState.gateway).forEach(key => (prevState.gateway[key] = gateway[key]));
      return {
        gateway: prevState.gateway
      };
    });
  };

  onChangeK8sGateway = (k8sGateway: K8sGatewayState): void => {
    this.setState(prevState => {
      Object.keys(prevState.k8sGateway).forEach(key => (prevState.k8sGateway[key] = k8sGateway[key]));
      return {
        k8sGateway: prevState.k8sGateway
      };
    });
  };

  onChangeK8sReferenceGrant = (k8sReferenceGrant: K8sReferenceGrantState): void => {
    this.setState(prevState => {
      Object.keys(prevState.k8sReferenceGrant).forEach(
        key => (prevState.k8sReferenceGrant[key] = k8sReferenceGrant[key])
      );
      return {
        k8sReferenceGrant: prevState.k8sReferenceGrant
      };
    });
  };

  onChangePeerAuthentication = (peerAuthentication: PeerAuthenticationState): void => {
    this.setState(prevState => {
      Object.keys(prevState.peerAuthentication).forEach(
        key => (prevState.peerAuthentication[key] = peerAuthentication[key])
      );
      return {
        peerAuthentication: prevState.peerAuthentication
      };
    });
  };

  onChangeRequestAuthentication = (requestAuthentication: RequestAuthenticationState): void => {
    this.setState(prevState => {
      Object.keys(prevState.requestAuthentication).forEach(
        key => (prevState.requestAuthentication[key] = requestAuthentication[key])
      );
      return {
        requestAuthentication: prevState.requestAuthentication
      };
    });
  };

  onChangeServiceEntry = (serviceEntry: ServiceEntryState): void => {
    this.setState(prevState => {
      Object.keys(prevState.serviceEntry).forEach(key => (prevState.serviceEntry[key] = serviceEntry[key]));
      return {
        serviceEntry: prevState.serviceEntry
      };
    });
  };

  onChangeSidecar = (sidecar: SidecarState): void => {
    this.setState(prevState => {
      Object.keys(prevState.sidecar).forEach(key => (prevState.sidecar[key] = sidecar[key]));
      return {
        sidecar: prevState.sidecar
      };
    });
  };

  render(): React.ReactNode {
    const canCreate = this.props.activeNamespaces.every(ns => this.canCreate(ns.name));
    const isNameValid = isValidK8SName(this.state.name);
    const isNamespacesValid = this.props.activeNamespaces.length > 0;
    const isMultiCluster = Object.keys(serverConfig.clusters).length > 1;
    const isClustersValid = this.props.activeClusters.length > 0 || !isMultiCluster;
    const isFormValid = isNameValid && isNamespacesValid && isClustersValid && this.isIstioFormValid();
    return (
      <>
        <div>
          <DefaultSecondaryMasthead showClusterSelector={false} hideNamespaceSelector={true} />
        </div>
        <RenderContent>
          <Form className={formPadding} isHorizontal={true}>
            <FormGroup label="Namespaces" isRequired={true} fieldId="namespaces">
              <NamespaceDropdown disabled={false} />
              {!isValid(isNamespacesValid) && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>An Istio Config resource needs at least one namespace selected</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
            {isMultiCluster && (
              <FormGroup label="Clusters" isRequired={true} fieldId="clusters">
                <ClusterDropdown />
                {!isValid(isClustersValid) && (
                  <FormHelperText>
                    <HelperText>
                      <HelperTextItem>An Istio Config resource needs at least one cluster selected</HelperTextItem>
                    </HelperText>
                  </FormHelperText>
                )}
              </FormGroup>
            )}
            <FormGroup label="Name" isRequired={true} fieldId="name">
              <TextInput
                value={this.state.name}
                isRequired={true}
                type="text"
                id="name"
                aria-describedby="name"
                name="name"
                onChange={this.onNameChange}
                validated={isValid(isNameValid)}
              />
              {!isValid(isNameValid) && (
                <FormHelperText>
                  <HelperText>
                    <HelperTextItem>{`A valid ${this.props.objectType} name is required`}</HelperTextItem>
                  </HelperText>
                </FormHelperText>
              )}
            </FormGroup>
            {this.props.objectType === AUTHORIZACION_POLICY && (
              <AuthorizationPolicyForm
                authorizationPolicy={this.state.authorizationPolicy}
                onChange={this.onChangeAuthorizationPolicy}
              />
            )}
            {this.props.objectType === GATEWAY && (
              <GatewayForm gateway={this.state.gateway} onChange={this.onChangeGateway} />
            )}
            {this.props.objectType === K8SGATEWAY && (
              <K8sGatewayForm k8sGateway={this.state.k8sGateway} onChange={this.onChangeK8sGateway} />
            )}
            {this.props.objectType === K8SREFERENCEGRANT && (
              <K8sReferenceGrantForm
                k8sReferenceGrant={this.state.k8sReferenceGrant}
                onChange={this.onChangeK8sReferenceGrant}
              />
            )}
            {this.props.objectType === PEER_AUTHENTICATION && (
              <PeerAuthenticationForm
                peerAuthentication={this.state.peerAuthentication}
                onChange={this.onChangePeerAuthentication}
              />
            )}
            {this.props.objectType === REQUEST_AUTHENTICATION && (
              <RequestAuthenticationForm
                requestAuthentication={this.state.requestAuthentication}
                onChange={this.onChangeRequestAuthentication}
              />
            )}
            {this.props.objectType === SERVICE_ENTRY && (
              <ServiceEntryForm serviceEntry={this.state.serviceEntry} onChange={this.onChangeServiceEntry} />
            )}
            {this.props.objectType === SIDECAR && (
              <SidecarForm sidecar={this.state.sidecar} onChange={this.onChangeSidecar} />
            )}
            <FormGroup fieldId="labels" label="Labels">
              <div className={editStyle}>
                <Labels labels={this.state.labels} expanded={true} />
                <Button
                  className={editButton}
                  type="button"
                  variant="link"
                  isInline
                  onClick={() => this.onLabelsWizardToggle(true)}
                  data-test={'edit-labels'}
                >
                  Edit
                  <KialiIcon.PencilAlt className={editIcon} />
                </Button>
              </div>
              <WizardLabels
                showAnotationsWizard={this.state.showLabelsWizard}
                type={'labels'}
                onChange={labels => this.onAddLabels(labels)}
                onClose={() => this.onLabelsWizardToggle(false)}
                labels={this.state.labels}
                canEdit={true}
              />
            </FormGroup>
            <FormGroup fieldId="annotations" label="Annotations">
              <div className={editStyle}>
                <Labels labels={this.state.annotations} type={'annotations'} expanded={true} />
                <Button
                  className={editButton}
                  type="button"
                  variant="link"
                  isInline
                  onClick={() => this.onAnnotationsWizardToggle(true)}
                  data-test={'edit-annotations'}
                >
                  Edit
                  <KialiIcon.PencilAlt className={editIcon} />
                </Button>
              </div>
              <WizardLabels
                showAnotationsWizard={this.state.showAnnotationsWizard}
                type={'annotations'}
                onChange={annotations => this.onAddAnnotations(annotations)}
                onClose={() => this.onAnnotationsWizardToggle(false)}
                labels={this.state.annotations}
                canEdit={true}
              />
            </FormGroup>
            <ActionGroup>
              <Button
                variant={ButtonVariant.primary}
                isDisabled={!isFormValid}
                onClick={() => this.showPreview()}
                data-test={'preview'}
              >
                Preview
              </Button>
              <Button variant={ButtonVariant.secondary} onClick={() => this.backToList()}>
                Cancel
              </Button>
            </ActionGroup>
          </Form>
          <IstioConfigPreview
            isOpen={this.state.showPreview}
            items={this.state.itemsPreview}
            title={'Preview new istio objects'}
            opTarget={'create'}
            disableAction={!canCreate}
            ns={this.props.activeNamespaces.join(',')}
            onConfirm={items =>
              this.setState({ showPreview: false, itemsPreview: items }, () => this.onIstioResourceCreate())
            }
            onClose={() => this.setState({ showPreview: false })}
          />
        </RenderContent>
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState): Props => {
  return {
    activeClusters: activeClustersSelector(state),
    activeNamespaces: activeNamespacesSelector(state),
    namespacesPerCluster: namespacesPerClusterSelector(state)
  };
};

export const IstioConfigNewPage = connect(mapStateToProps)(IstioConfigNewPageComponent);
