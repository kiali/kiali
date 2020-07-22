import * as React from 'react';
import { KialiAppState } from '../../../../store/Store';
import { activeNamespacesSelector } from '../../../../store/Selectors';
import { connect } from 'react-redux';
import { RenderContent } from '../../../../components/Nav/Page';
import { style } from 'typestyle';
import { ActionGroup, Button, Form, FormGroup, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { isValidK8SName } from '../../../../helpers/ValidationHelpers';
import Namespace from '../../../../types/Namespace';
import { IstioPermissions } from '../../../../types/IstioConfigDetails';
import { PromisesRegistry } from '../../../../utils/CancelablePromises';
import * as API from '../../../../services/Api';
import * as AlertUtils from '../../../../utils/AlertUtils';
import history from '../../../../app/History';
import { Paths, serverConfig } from '../../../../config';
import { isValidUrl } from '../../../../utils/IstioConfigUtils';
import {
  buildThreeScaleHandler,
  buildThreeScaleInstance,
  buildThreeScaleRule
} from '../../../../components/IstioWizards/WizardActions';
import { MessageType } from '../../../../types/MessageCenter';

interface Props {
  activeNamespaces: Namespace[];
}

export interface ThreeScaleState {
  name: string;
  istioPermissions: IstioPermissions;
  threeScaleConfig: string;
  url: string;
  token: string;
  handlers: string[];
  handler: string;
}

// Style constants
const formPadding = style({ padding: '30px 20px 30px 20px' });

const HANDLERS = 'handlers';
const INSTANCES = 'instances';
const RULES = 'rules';

const THREESCALE_ACCOUNT = 'account';
const THREESCALE_AUTHORIZATION = 'authorization';

const threeScaleConfigOptions = [
  { value: THREESCALE_ACCOUNT, label: '3scale Account (Istio Handler)', disabled: false },
  { value: THREESCALE_AUTHORIZATION, label: '3scale Authorization (Istio Instance+Rule)', disabled: false }
];

const initState = (): ThreeScaleState => ({
  name: '',
  istioPermissions: {},
  threeScaleConfig: threeScaleConfigOptions[0].value,
  url: 'https://replaceme-admin.3scale.net:443',
  token: 'replaceme',
  handlers: [],
  handler: ''
});

class ThreeScaleNewPage extends React.Component<Props, ThreeScaleState> {
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
    this.fetchPermissions();
    this.fetchHandlers();
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.activeNamespaces.length !== this.props.activeNamespaces.length ||
      !prevProps.activeNamespaces.every(v => this.props.activeNamespaces.includes(v))
    ) {
      this.fetchPermissions();
      this.fetchHandlers();
    }
  }

  canCreate = (namespace: string): boolean => {
    // 3scale extension needs permissions on old Mixer objects
    return (
      this.state.istioPermissions[namespace] &&
      this.state.istioPermissions[namespace][HANDLERS].create &&
      this.state.istioPermissions[namespace][INSTANCES].create &&
      this.state.istioPermissions[namespace][RULES].create
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

  fetchHandlers = () => {
    if (this.props.activeNamespaces.length > 0) {
      this.promises
        .registerAll(
          'handlers',
          this.props.activeNamespaces.map(n =>
            API.getIstioConfig(n.name, ['handlers'], false, 'kiali_wizard=threescale')
          )
        )
        .then(responses => {
          const handlers: string[] = [];
          responses.forEach(response => response.data!.handlers.forEach(h => handlers.push(h.metadata.name)));
          this.setState({
            handlers: handlers,
            handler: handlers.length > 0 ? handlers[0] : ''
          });
        })
        .catch(error => {
          // Canceled errors are expected on this query when page is unmounted
          if (!error.isCanceled) {
            AlertUtils.addError('Could not fetch Handlers.', error);
          }
        });
    }
  };

  backToList = () => {
    this.setState(initState(), () => {
      // Back to list page
      history.push(`/${Paths.ISTIO}?namespaces=${this.props.activeNamespaces.map(n => n.name).join(',')}`);
    });
  };

  onThreeScaleConfigCreate = () => {
    const jsonHandlers: { namespace: string; json: string }[] = [];
    const jsonInstances: { namespace: string; json: string }[] = [];
    const jsonRules: { namespace: string; json: string }[] = [];
    this.props.activeNamespaces.forEach(ns => {
      switch (this.state.threeScaleConfig) {
        case THREESCALE_ACCOUNT:
          jsonHandlers.push({
            namespace: ns.name,
            json: JSON.stringify(buildThreeScaleHandler(this.state.name, ns.name, this.state))
          });
          break;
        case THREESCALE_AUTHORIZATION:
          jsonInstances.push({
            namespace: ns.name,
            json: JSON.stringify(buildThreeScaleInstance(this.state.name, ns.name))
          });
          jsonRules.push({
            namespace: ns.name,
            json: JSON.stringify(buildThreeScaleRule(this.state.name, ns.name, this.state))
          });
          break;
      }
    });
    if (this.state.threeScaleConfig === THREESCALE_ACCOUNT) {
      this.promises
        .registerAll(
          'Create 3scale Handlers',
          jsonHandlers.map(o => API.createIstioConfigDetail(o.namespace, 'handlers', o.json))
        )
        .then(results => {
          if (results.length > 0) {
            AlertUtils.add('Istio Handlers created', 'default', MessageType.SUCCESS);
          }
          this.backToList();
        })
        .catch(error => {
          AlertUtils.addError('Could not create Istio Handler objects.', error);
        });
    }
    if (this.state.threeScaleConfig === THREESCALE_AUTHORIZATION) {
      this.promises
        .registerAll(
          'Create 3scale Instances+Rules',
          jsonInstances
            .map(o => API.createIstioConfigDetail(o.namespace, 'instances', o.json))
            .concat(jsonRules.map(o => API.createIstioConfigDetail(o.namespace, 'rules', o.json)))
        )
        .then(results => {
          if (results.length > 0) {
            AlertUtils.add('Istio Instances+Rules created', 'default', MessageType.SUCCESS);
          }
          this.backToList();
        })
        .catch(error => {
          AlertUtils.addError('Could not create Istio Instances+Rules objects.', error);
        });
    }
  };

  onThreeScaleConfigChange = (value, _) => {
    this.setState({
      threeScaleConfig: value,
      name: ''
    });
  };

  onNameChange = (value, _) => {
    this.setState({
      name: value
    });
  };

  onUrlChange = (value, _) => {
    this.setState({
      url: value
    });
  };

  onTokenChange = (value, _) => {
    this.setState({
      token: value
    });
  };

  onHandlerChange = (value, _) => {
    this.setState({
      handler: value
    });
  };

  render() {
    const canCreate = this.props.activeNamespaces.every(ns => this.canCreate(ns.name));
    const isNameValid = isValidK8SName(this.state.name);
    // It should be a single namespace where Istio Control Plane is located
    const isNamespacesValid =
      this.props.activeNamespaces.length === 1 && serverConfig.istioNamespace === this.props.activeNamespaces[0].name;
    const isUrlValid = isValidUrl(this.state.url);
    const isTokenValid = this.state.token.length > 0;
    const isThreeScaleAccountValid =
      this.state.threeScaleConfig === THREESCALE_ACCOUNT ? isUrlValid && isTokenValid : true;
    const isThreeScaleAuthorizationValid =
      this.state.threeScaleConfig === THREESCALE_AUTHORIZATION ? this.state.handler.length > 0 : true;
    const isFormValid =
      canCreate && isNameValid && isNamespacesValid && isThreeScaleAccountValid && isThreeScaleAuthorizationValid;
    const nameText = this.state.threeScaleConfig === THREESCALE_ACCOUNT ? 'Istio Handler ' : 'Istio Instance+Rule ';
    return (
      <RenderContent>
        <Form className={formPadding} isHorizontal={true}>
          <FormGroup
            label="Namespaces"
            isRequired={true}
            fieldId="namespaces"
            helperText={'Istio control plane namespace where this configuration will be applied'}
            helperTextInvalid={'Select the Istio control plane namespace where this configuration will be applied'}
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
          <FormGroup label="3scale Config" fieldId="theescale-config">
            <FormSelect
              value={this.state.threeScaleConfig}
              onChange={this.onThreeScaleConfigChange}
              id="threescale-config"
              name="threescale-config"
            >
              {threeScaleConfigOptions.map((option, index) => (
                <FormSelectOption isDisabled={option.disabled} key={index} value={option.value} label={option.label} />
              ))}
            </FormSelect>
          </FormGroup>
          <FormGroup
            label="Name"
            isRequired={true}
            fieldId="name"
            helperText={nameText + ' name'}
            helperTextInvalid={'A valid ' + nameText + ' name is required'}
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
          {this.state.threeScaleConfig === THREESCALE_ACCOUNT && (
            <>
              <FormGroup
                label="3scale Admin Portal URL"
                isRequired={true}
                fieldId="threescale-url"
                helperTextInvalid={'A valid 3scale Admin Portal URL is required'}
                isValid={isUrlValid}
              >
                <TextInput
                  value={this.state.url}
                  isRequired={true}
                  type="text"
                  id="threescale-url"
                  aria-describedby="threescale-url"
                  name="threescale-url"
                  onChange={this.onUrlChange}
                  isValid={isUrlValid}
                />
              </FormGroup>
              <FormGroup
                label="3scale Access Token"
                isRequired={true}
                fieldId="threescale-token"
                helperTextInvalid={'A non empty token is required'}
                isValid={isTokenValid}
              >
                <TextInput
                  value={this.state.token}
                  isRequired={true}
                  type="text"
                  id="threescale-token"
                  aria-describedby="threescale-token"
                  name="threescale-token"
                  onChange={this.onTokenChange}
                  isValid={isTokenValid}
                />
              </FormGroup>
            </>
          )}
          {this.state.threeScaleConfig === THREESCALE_AUTHORIZATION && (
            <>
              <FormGroup
                label="3scale Account"
                fieldId="theescale-handler"
                isRequired={true}
                helperText={'Select a 3scale Account represented by an Istio Handler'}
                helperTextInvalid={'A 3scale Account represented by an Istio Handler is required'}
                isValid={this.state.handlers.length > 0}
              >
                <FormSelect
                  value={this.state.handler}
                  isRequired={true}
                  onChange={this.onHandlerChange}
                  id="theescale-handler"
                  name="theescale-handler"
                  isValid={this.state.handlers.length > 0}
                >
                  {this.state.handlers.map((value, index) => (
                    <FormSelectOption isDisabled={false} key={index} value={value} label={value} />
                  ))}
                </FormSelect>
              </FormGroup>
            </>
          )}
          <ActionGroup>
            <Button variant="primary" isDisabled={!isFormValid} onClick={() => this.onThreeScaleConfigCreate()}>
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

const ThreeScaleNewPageContainer = connect(mapStateToProps, null)(ThreeScaleNewPage);

export default ThreeScaleNewPageContainer;
