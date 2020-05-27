import * as React from 'react';
import { KialiAppState } from '../../store/Store';
import { activeNamespacesSelector } from '../../store/Selectors';
import { connect } from 'react-redux';
import Namespace from '../../types/Namespace';
import { ActionGroup, Button, Form, FormGroup, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
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
  buildSidecar
} from '../../components/IstioWizards/IstioWizardActions';
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

type Props = {
  activeNamespaces: Namespace[];
};

type State = {
  istioResource: string;
  name: string;
  istioPermissions: IstioPermissions;
  authorizationPolicy: AuthorizationPolicyState;
  gateway: GatewayState;
  peerAuthentication: PeerAuthenticationState;
  requestAuthentication: RequestAuthenticationState;
  sidecar: SidecarState;
};

const formPadding = style({ padding: '30px 20px 30px 20px' });

const DIC = {
  AuthorizationPolicy: AUTHORIZATION_POLICIES,
  Gateway: GATEWAYS,
  PeerAuthentication: PEER_AUTHENTICATIONS,
  RequestAuthentication: REQUEST_AUTHENTICATIONS,
  Sidecar: SIDECARS
};

const istioResourceOptions = [
  { value: AUTHORIZACION_POLICY, label: AUTHORIZACION_POLICY, disabled: false },
  { value: GATEWAY, label: GATEWAY, disabled: false },
  { value: PEER_AUTHENTICATION, label: PEER_AUTHENTICATION, disabled: false },
  { value: REQUEST_AUTHENTICATION, label: REQUEST_AUTHENTICATION, disabled: false },
  { value: SIDECAR, label: SIDECAR, disabled: false }
];

const initState = (): State => ({
  istioResource: istioResourceOptions[0].value,
  name: '',
  istioPermissions: {},
  authorizationPolicy: initAuthorizationPolicy(),
  gateway: initGateway(),
  peerAuthentication: initPeerAuthentication(),
  requestAuthentication: initRequestAuthentication(),
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
      this.state.istioResource.length > 0 &&
      this.state.istioPermissions[namespace][DIC[this.state.istioResource]].create
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
                  AlertUtils.addWarning('User has not permissions to create Istio Config on namespace: ' + ns.name);
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

  onIstioResourceChange = (value, _) => {
    this.setState({
      istioResource: value,
      name: ''
    });
  };

  onNameChange = (value, _) => {
    this.setState({
      name: value
    });
  };

  onIstioResourceCreate = () => {
    const jsonIstioObjects: { namespace: string; json: string }[] = [];
    this.props.activeNamespaces.forEach(ns => {
      switch (this.state.istioResource) {
        case AUTHORIZACION_POLICY:
          jsonIstioObjects.push({
            namespace: ns.name,
            json: JSON.stringify(buildAuthorizationPolicy(this.state.name, ns.name, this.state.authorizationPolicy))
          });
          break;
        case GATEWAY:
          jsonIstioObjects.push({
            namespace: ns.name,
            json: JSON.stringify(buildGateway(this.state.name, ns.name, this.state.gateway))
          });
          break;
        case PEER_AUTHENTICATION:
          jsonIstioObjects.push({
            namespace: ns.name,
            json: JSON.stringify(buildPeerAuthentication(this.state.name, ns.name, this.state.peerAuthentication))
          });
          break;
        case REQUEST_AUTHENTICATION:
          jsonIstioObjects.push({
            namespace: ns.name,
            json: JSON.stringify(buildRequestAuthentication(this.state.name, ns.name, this.state.requestAuthentication))
          });
          break;
        case SIDECAR:
          jsonIstioObjects.push({
            namespace: ns.name,
            json: JSON.stringify(buildSidecar(this.state.name, ns.name, this.state.sidecar))
          });
          break;
      }
    });

    this.promises
      .registerAll(
        'Create ' + DIC[this.state.istioResource],
        jsonIstioObjects.map(o => API.createIstioConfigDetail(o.namespace, DIC[this.state.istioResource], o.json))
      )
      .then(results => {
        if (results.length > 0) {
          AlertUtils.add('Istio ' + this.state.istioResource + ' created', 'default', MessageType.SUCCESS);
        }
        this.backToList();
      })
      .catch(error => {
        AlertUtils.addError('Could not create Istio ' + this.state.istioResource + ' objects.', error);
      });
  };

  backToList = () => {
    this.setState(initState(), () => {
      // Back to list page
      history.push(`/${Paths.ISTIO}?namespaces=${this.props.activeNamespaces.join(',')}`);
    });
  };

  isIstioFormValid = (): boolean => {
    switch (this.state.istioResource) {
      case AUTHORIZACION_POLICY:
        return isAuthorizationPolicyStateValid(this.state.authorizationPolicy);
      case GATEWAY:
        return isGatewayStateValid(this.state.gateway);
      case PEER_AUTHENTICATION:
        return isPeerAuthenticationStateValid(this.state.peerAuthentication);
      case REQUEST_AUTHENTICATION:
        return isRequestAuthenticationStateValid(this.state.requestAuthentication);
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
    const isFormValid = canCreate && isNameValid && isNamespacesValid && this.isIstioFormValid();
    return (
      <RenderContent>
        <Form className={formPadding} isHorizontal={true}>
          <FormGroup
            label="Namespaces"
            isRequired={true}
            fieldId="namespaces"
            helperText={'Select namespace(s) where this configuration will be applied'}
            helperTextInvalid={'At least one namespace should be selected'}
            isValid={isNamespacesValid}
          >
            <TextInput
              value={this.props.activeNamespaces.map(n => n.name).join(',')}
              isRequired={true}
              type="text"
              id="namespaces"
              aria-describedby="namespaces"
              name="namespaces"
              isDisabled={true}
              isValid={isNamespacesValid}
            />
          </FormGroup>
          <FormGroup label="Istio Resource" fieldId="istio-resource">
            <FormSelect
              value={this.state.istioResource}
              onChange={this.onIstioResourceChange}
              id="istio-resource"
              name="istio-resource"
            >
              {istioResourceOptions.map((option, index) => (
                <FormSelectOption isDisabled={option.disabled} key={index} value={option.value} label={option.label} />
              ))}
            </FormSelect>
          </FormGroup>
          <FormGroup
            label="Name"
            isRequired={true}
            fieldId="name"
            helperText={this.state.istioResource + ' name'}
            helperTextInvalid={'A valid ' + this.state.istioResource + ' name is required'}
            isValid={isNameValid}
          >
            <TextInput
              value={this.state.name}
              isRequired={true}
              type="text"
              id="name"
              aria-describedby="name"
              name="name"
              onChange={this.onNameChange}
              isValid={isNameValid}
            />
          </FormGroup>
          {this.state.istioResource === AUTHORIZACION_POLICY && (
            <AuthorizationPolicyForm
              authorizationPolicy={this.state.authorizationPolicy}
              onChange={this.onChangeAuthorizationPolicy}
            />
          )}
          {this.state.istioResource === GATEWAY && (
            <GatewayForm gateway={this.state.gateway} onChange={this.onChangeGateway} />
          )}
          {this.state.istioResource === PEER_AUTHENTICATION && (
            <PeerAuthenticationForm
              peerAuthentication={this.state.peerAuthentication}
              onChange={this.onChangePeerAuthentication}
            />
          )}
          {this.state.istioResource === REQUEST_AUTHENTICATION && (
            <RequestAuthenticationForm
              requestAuthentication={this.state.requestAuthentication}
              onChange={this.onChangeRequestAuthentication}
            />
          )}
          {this.state.istioResource === SIDECAR && (
            <SidecarForm sidecar={this.state.sidecar} onChange={this.onChangeSidecar} />
          )}
          <ActionGroup>
            <Button variant="primary" isDisabled={!isFormValid} onClick={() => this.onIstioResourceCreate()}>
              Create
            </Button>
            <Button variant="secondary" onClick={() => this.backToList()}>
              Cancel
            </Button>
          </ActionGroup>
        </Form>
      </RenderContent>
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
