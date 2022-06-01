import * as React from 'react';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import Namespace from '../../types/Namespace';
import { ActionGroup, Button, ButtonVariant, Form, FormGroup, TextInput } from '@patternfly/react-core';
import { RenderContent } from '../../components/Nav/Page';
import { style } from 'typestyle';
import GatewayForm, { GATEWAY, GATEWAYS, GatewayState, initGateway, isGatewayStateValid } from './GatewayForm';
import SidecarForm, { initSidecar, isSidecarStateValid, SIDECAR, SIDECARS, SidecarState } from './SidecarForm';
import { Paths, serverConfig } from '../../config';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import * as API from '../../services/Api';
import { IstioPermissions } from '../../types/IstioConfigDetails';
import * as AlertUtils from '../../utils/AlertUtils';
import history from '../../app/History';
import {
  buildAuthorizationPolicy,
  buildGateway,
  buildPeerAuthentication,
  buildRequestAuthentication,
  buildServiceEntry,
  buildSidecar
} from '../../components/IstioWizards/WizardActions';
import { MessageType } from '../../types/MessageCenter';
import AuthorizationPolicyForm, {
  AUTHORIZACION_POLICY,
  AUTHORIZATION_POLICIES,
  AuthorizationPolicyState,
  initAuthorizationPolicy,
  isAuthorizationPolicyStateValid
} from './AuthorizationPolicyForm';
import PeerAuthenticationForm, {
  initPeerAuthentication,
  isPeerAuthenticationStateValid,
  PEER_AUTHENTICATION,
  PEER_AUTHENTICATIONS,
  PeerAuthenticationState
} from './PeerAuthenticationForm';
import RequestAuthenticationForm, {
  initRequestAuthentication,
  isRequestAuthenticationStateValid,
  REQUEST_AUTHENTICATION,
  REQUEST_AUTHENTICATIONS,
  RequestAuthenticationState
} from './RequestAuthenticationForm';
import { isValidK8SName } from '../../helpers/ValidationHelpers';
import DefaultSecondaryMasthead from '../../components/DefaultSecondaryMasthead/DefaultSecondaryMasthead';
import { RouteComponentProps } from 'react-router-dom';
import { PFColors } from '../../components/Pf/PfColors';
import ServiceEntryForm, {
  initServiceEntry,
  isServiceEntryValid,
  SERVICE_ENTRIES,
  SERVICE_ENTRY,
  ServiceEntryState
} from './ServiceEntryForm';
import { ConfigPreviewItem, IstioConfigPreview } from 'components/IstioConfigPreview/IstioConfigPreview';
import { isValid } from 'utils/Common';

export interface IstioConfigNewPageId {
  objectType: string;
}

type Props = RouteComponentProps<IstioConfigNewPageId> & {
  activeNamespaces: Namespace[];
};

type State = {
  name: string;
  showPreview: boolean;
  itemsPreview: ConfigPreviewItem[];
  istioPermissions: IstioPermissions;
  authorizationPolicy: AuthorizationPolicyState;
  gateway: GatewayState;
  peerAuthentication: PeerAuthenticationState;
  requestAuthentication: RequestAuthenticationState;
  serviceEntry: ServiceEntryState;
  sidecar: SidecarState;
};

const formPadding = style({ padding: '30px 20px 30px 20px' });

const warningStyle = style({
  marginLeft: 15,
  paddingTop: 5,
  color: PFColors.Red100,
  textAlign: 'center'
});

const DIC = {
  AuthorizationPolicy: AUTHORIZATION_POLICIES,
  Gateway: GATEWAYS,
  PeerAuthentication: PEER_AUTHENTICATIONS,
  RequestAuthentication: REQUEST_AUTHENTICATIONS,
  ServiceEntry: SERVICE_ENTRIES,
  Sidecar: SIDECARS
};

// Used in the Istio Config list Actions
export const NEW_ISTIO_RESOURCE = [
  { value: AUTHORIZACION_POLICY, label: AUTHORIZACION_POLICY, disabled: false },
  { value: GATEWAY, label: GATEWAY, disabled: false },
  { value: PEER_AUTHENTICATION, label: PEER_AUTHENTICATION, disabled: false },
  { value: REQUEST_AUTHENTICATION, label: REQUEST_AUTHENTICATION, disabled: false },
  { value: SERVICE_ENTRY, label: SERVICE_ENTRY, disabled: false },
  { value: SIDECAR, label: SIDECAR, disabled: false }
];

const initState = (): State => ({
  name: '',
  istioPermissions: {},
  showPreview: false,
  itemsPreview: [],
  authorizationPolicy: initAuthorizationPolicy(),
  gateway: initGateway(),
  peerAuthentication: initPeerAuthentication(),
  requestAuthentication: initRequestAuthentication(),
  serviceEntry: initServiceEntry(),
  // Init with the istio-system/* for sidecar
  sidecar: initSidecar(serverConfig.istioNamespace + '/*')
});

class IstioConfigNewPage extends React.Component<Props, State> {
  private promises = new PromisesRegistry();

  constructor(props: Props) {
    super(props);
    this.state = initState();
  }

  componentWillUnmount() {
    this.promises.cancelAll();
  }

  componentDidMount() {
    // Init component state
    this.setState(Object.assign({}, initState));
    this.fetchPermissions();
  }

  componentDidUpdate(prevProps: Props, _prevState: State) {
    if (prevProps.activeNamespaces !== this.props.activeNamespaces) {
      this.fetchPermissions();
    }
  }

  canCreate = (namespace: string): boolean => {
    return (
      this.state.istioPermissions[namespace] &&
      this.props.match.params.objectType.length > 0 &&
      this.state.istioPermissions[namespace][DIC[this.props.match.params.objectType]].create
    );
  };

  fetchPermissions = () => {
    if (this.props.activeNamespaces.length > 0) {
      this.promises
        .register('permissions', API.getIstioPermissions(this.props.activeNamespaces.map(n => n.name)))
        .then(permResponse => {
          this.setState(
            {
              istioPermissions: permResponse.data
            },
            () => {
              this.props.activeNamespaces.forEach(ns => {
                if (!this.canCreate(ns.name)) {
                  AlertUtils.addWarning(
                    'User does not have permission to create Istio Config on namespace: ' + ns.name
                  );
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

  onNameChange = (value, _) => {
    this.setState({
      name: value
    });
  };

  onIstioResourceCreate = () => {
    const jsonIstioObjects: { namespace: string; json: string }[] = this.state.itemsPreview.map(item => ({
      namespace: item.items[0].metadata.namespace || '',
      json: JSON.stringify(item.items[0])
    }));

    this.promises
      .registerAll(
        'Create ' + DIC[this.props.match.params.objectType],
        jsonIstioObjects.map(o =>
          API.createIstioConfigDetail(o.namespace, DIC[this.props.match.params.objectType], o.json)
        )
      )
      .then(results => {
        if (results.length > 0) {
          AlertUtils.add('Istio ' + this.props.match.params.objectType + ' created', 'default', MessageType.SUCCESS);
        }
        this.backToList();
      })
      .catch(error => {
        AlertUtils.addError('Could not create Istio ' + this.props.match.params.objectType + ' objects.', error);
      });
  };

  showPreview = () => {
    const items: ConfigPreviewItem[] = [];
    this.props.activeNamespaces.forEach(ns => {
      switch (this.props.match.params.objectType) {
        case AUTHORIZACION_POLICY:
          items.push({
            title: 'Authorization Policy',
            type: 'authorizationpolicy',
            items: [buildAuthorizationPolicy(this.state.name, ns.name, this.state.authorizationPolicy)]
          });
          break;
        case GATEWAY:
          items.push({
            title: 'Gateway',
            type: 'gateway',
            items: [buildGateway(this.state.name, ns.name, this.state.gateway)]
          });
          break;
        case PEER_AUTHENTICATION:
          items.push({
            title: 'Peer Authentication',
            type: 'peerauthentication',
            items: [buildPeerAuthentication(this.state.name, ns.name, this.state.peerAuthentication)]
          });
          break;
        case REQUEST_AUTHENTICATION:
          items.push({
            title: 'Request Authentication',
            type: 'requestauthentication',
            items: [buildRequestAuthentication(this.state.name, ns.name, this.state.requestAuthentication)]
          });
          break;
        case SERVICE_ENTRY:
          items.push({
            title: 'Service Entry',
            type: 'serviceentry',
            items: [buildServiceEntry(this.state.name, ns.name, this.state.serviceEntry)]
          });
          break;
        case SIDECAR:
          items.push({
            title: 'Sidecar',
            type: 'sidecar',
            items: [buildSidecar(this.state.name, ns.name, this.state.sidecar)]
          });
          break;
      }
    });
    this.setState({ itemsPreview: items, showPreview: true });
    //this.onIstioResourceCreate()
  };

  backToList = () => {
    this.setState(initState(), () => {
      // Back to list page
      history.push(`/${Paths.ISTIO}?namespaces=${this.props.activeNamespaces.map(n => n.name).join(',')}`);
    });
  };

  isIstioFormValid = (): boolean => {
    switch (this.props.match.params.objectType) {
      case AUTHORIZACION_POLICY:
        return isAuthorizationPolicyStateValid(this.state.authorizationPolicy);
      case GATEWAY:
        return isGatewayStateValid(this.state.gateway);
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

  onChangeAuthorizationPolicy = (authorizationPolicy: AuthorizationPolicyState) => {
    this.setState(prevState => {
      Object.keys(prevState.authorizationPolicy).forEach(
        key => (prevState.authorizationPolicy[key] = authorizationPolicy[key])
      );
      return {
        authorizationPolicy: prevState.authorizationPolicy
      };
    });
  };

  onChangeGateway = (gateway: GatewayState) => {
    this.setState(prevState => {
      Object.keys(prevState.gateway).forEach(key => (prevState.gateway[key] = gateway[key]));
      return {
        gateway: prevState.gateway
      };
    });
  };

  onChangePeerAuthentication = (peerAuthentication: PeerAuthenticationState) => {
    this.setState(prevState => {
      Object.keys(prevState.peerAuthentication).forEach(
        key => (prevState.peerAuthentication[key] = peerAuthentication[key])
      );
      return {
        peerAuthentication: prevState.peerAuthentication
      };
    });
  };

  onChangeRequestAuthentication = (requestAuthentication: RequestAuthenticationState) => {
    this.setState(prevState => {
      Object.keys(prevState.requestAuthentication).forEach(
        key => (prevState.requestAuthentication[key] = requestAuthentication[key])
      );
      return {
        requestAuthentication: prevState.requestAuthentication
      };
    });
  };

  onChangeServiceEntry = (serviceEntry: ServiceEntryState) => {
    this.setState(prevState => {
      Object.keys(prevState.serviceEntry).forEach(key => (prevState.serviceEntry[key] = serviceEntry[key]));
      return {
        serviceEntry: prevState.serviceEntry
      };
    });
  };

  onChangeSidecar = (sidecar: SidecarState) => {
    this.setState(prevState => {
      Object.keys(prevState.sidecar).forEach(key => (prevState.sidecar[key] = sidecar[key]));
      return {
        sidecar: prevState.sidecar
      };
    });
  };

  render() {
    const canCreate = this.props.activeNamespaces.every(ns => this.canCreate(ns.name));
    const isNameValid = isValidK8SName(this.state.name);
    const isNamespacesValid = this.props.activeNamespaces.length > 0;
    const isFormValid = isNameValid && isNamespacesValid && this.isIstioFormValid();
    return (
      <>
        <div style={{ backgroundColor: '#fff' }}>
          <DefaultSecondaryMasthead />
        </div>
        <RenderContent>
          <Form className={formPadding} isHorizontal={true}>
            <FormGroup
              label="Name"
              isRequired={true}
              fieldId="name"
              helperTextInvalid={'A valid ' + this.props.match.params.objectType + ' name is required'}
              validated={isValid(isNameValid)}
            >
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
            </FormGroup>
            {this.props.match.params.objectType === AUTHORIZACION_POLICY && (
              <AuthorizationPolicyForm
                authorizationPolicy={this.state.authorizationPolicy}
                onChange={this.onChangeAuthorizationPolicy}
              />
            )}
            {this.props.match.params.objectType === GATEWAY && (
              <GatewayForm gateway={this.state.gateway} onChange={this.onChangeGateway} />
            )}
            {this.props.match.params.objectType === PEER_AUTHENTICATION && (
              <PeerAuthenticationForm
                peerAuthentication={this.state.peerAuthentication}
                onChange={this.onChangePeerAuthentication}
              />
            )}
            {this.props.match.params.objectType === REQUEST_AUTHENTICATION && (
              <RequestAuthenticationForm
                requestAuthentication={this.state.requestAuthentication}
                onChange={this.onChangeRequestAuthentication}
              />
            )}
            {this.props.match.params.objectType === SERVICE_ENTRY && (
              <ServiceEntryForm serviceEntry={this.state.serviceEntry} onChange={this.onChangeServiceEntry} />
            )}
            {this.props.match.params.objectType === SIDECAR && (
              <SidecarForm sidecar={this.state.sidecar} onChange={this.onChangeSidecar} />
            )}
            <ActionGroup>
              <Button variant={ButtonVariant.primary} isDisabled={!isFormValid} onClick={() => this.showPreview()}>
                Preview
              </Button>
              <Button variant={ButtonVariant.secondary} onClick={() => this.backToList()}>
                Cancel
              </Button>
              {!isNamespacesValid && (
                <span className={warningStyle}>An Istio Config resource needs at least a namespace selected</span>
              )}
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

const mapStateToProps = (state: KialiAppState) => {
  return {
    activeNamespaces: activeNamespacesSelector(state)
  };
};

const IstioConfigNewPageContainer = connect(mapStateToProps, null)(IstioConfigNewPage);

export default IstioConfigNewPageContainer;
