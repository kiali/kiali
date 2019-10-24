import * as React from 'react';
import { ThreeScaleHandler, ThreeScaleServiceRule } from '../../types/ThreeScale';
import {
  ActionGroup,
  Badge,
  Button,
  DataList,
  DataListItem,
  DataListItemRow,
  DataListCell,
  DataListAction,
  DataListToggle,
  DataListContent,
  DataListItemCells,
  Dropdown,
  DropdownItem,
  DropdownPosition,
  Expandable,
  Form,
  FormGroup,
  KebabToggle,
  TextInput,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { style } from 'typestyle';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { PfColors } from '../Pf/PfColors';

type Props = {
  serviceName: string;
  serviceNamespace: string;
  threeScaleServiceRule: ThreeScaleServiceRule;
  onChange: (valid: boolean, threeScaleServiceRule: ThreeScaleServiceRule) => void;
};

type ModifiedHandler = ThreeScaleHandler & {
  modified: boolean;
};

type State = {
  threeScaleHandlers: ModifiedHandler[];
  threeScaleServiceRule: ThreeScaleServiceRule;
  newThreeScaleHandler: ThreeScaleHandler;
  showCreateHandler: boolean;
  handlersExpanded: string[];
  actionsToggle: string[];
};

const k8sRegExpName = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

const noHandlerStyle = style({
  marginTop: 15,
  color: PfColors.Red100,
  textAlign: 'center',
  width: '100%',
  marginBottom: '10px'
});

class ThreeScaleIntegration extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      threeScaleHandlers: [],
      threeScaleServiceRule: props.threeScaleServiceRule,
      newThreeScaleHandler: {
        name: '',
        serviceId: '',
        accessToken: '',
        systemUrl: ''
      },
      showCreateHandler: false,
      handlersExpanded: [],
      actionsToggle: []
    };
  }

  componentDidMount() {
    this.fetchHandlers();
  }

  fetchHandlers = () => {
    API.getThreeScaleHandlers()
      .then(results => {
        this.setState(
          prevState => {
            let handlerName = prevState.threeScaleServiceRule.threeScaleHandlerName;
            if (handlerName === '' && results.data.length > 0) {
              handlerName = results.data[0].name;
            }
            return {
              threeScaleHandlers: results.data.map(h => {
                return {
                  name: h.name,
                  serviceId: h.serviceId,
                  accessToken: h.accessToken,
                  systemUrl: h.systemUrl,
                  modified: false
                };
              }),
              threeScaleServiceRule: {
                serviceName: prevState.threeScaleServiceRule.serviceName,
                serviceNamespace: prevState.threeScaleServiceRule.serviceNamespace,
                threeScaleHandlerName: handlerName
              }
            };
          },
          () => this.props.onChange(this.state.threeScaleHandlers.length > 0, this.state.threeScaleServiceRule)
        );
      })
      .catch(error => {
        AlertUtils.addError('Could not fetch ThreeScaleHandlers.', error);
      });
  };

  onUpdateHandler = (id: number) => {
    const handler = this.state.threeScaleHandlers[id];
    const patch = {
      name: handler.name,
      serviceId: handler.serviceId,
      accessToken: handler.accessToken,
      systemUrl: handler.systemUrl
    };
    API.updateThreeScaleHandler(this.state.threeScaleHandlers[id].name, JSON.stringify(patch))
      .then(results => {
        this.setState(
          prevState => {
            return {
              threeScaleHandlers: results.data.map(h => {
                return {
                  name: h.name,
                  serviceId: h.serviceId,
                  accessToken: h.accessToken,
                  systemUrl: h.systemUrl,
                  modified: false
                };
              }),
              threeScaleServiceRule: prevState.threeScaleServiceRule
            };
          },
          () => this.props.onChange(true, this.state.threeScaleServiceRule)
        );
      })
      .catch(error => {
        AlertUtils.addError('Could not update ThreeScaleHandlers.', error);
      });
  };

  onDeleteHandler = (handlerName: string) => {
    API.deleteThreeScaleHandler(handlerName)
      .then(results => {
        this.setState(
          prevState => {
            return {
              threeScaleHandlers: results.data.map(h => {
                return {
                  name: h.name,
                  serviceId: h.serviceId,
                  accessToken: h.accessToken,
                  systemUrl: h.systemUrl,
                  modified: false
                };
              }),
              threeScaleServiceRule: {
                serviceName: prevState.threeScaleServiceRule.serviceName,
                serviceNamespace: prevState.threeScaleServiceRule.serviceNamespace,
                threeScaleHandlerName:
                  prevState.threeScaleServiceRule.threeScaleHandlerName === handlerName
                    ? ''
                    : prevState.threeScaleServiceRule.threeScaleHandlerName
              }
            };
          },
          () => this.props.onChange(this.state.threeScaleHandlers.length > 0, this.state.threeScaleServiceRule)
        );
      })
      .catch(error => {
        AlertUtils.addError('Could not delete ThreeScaleHandlers.', error);
      });
  };

  isValid = () => {
    let isModified = true;
    this.state.threeScaleHandlers.forEach(handlers => {
      isModified = isModified && handlers.modified;
    });
    const isNewModified =
      this.state.newThreeScaleHandler.name !== '' ||
      this.state.newThreeScaleHandler.serviceId !== '' ||
      this.state.newThreeScaleHandler.systemUrl !== '' ||
      this.state.newThreeScaleHandler.accessToken !== '';
    return !(isModified || isNewModified);
  };

  onChangeHandler = (selectedId: number, field: string, value: string) => {
    this.setState(prevState => {
      const newThreeScaleHandler = prevState.newThreeScaleHandler;
      if (selectedId === -1) {
        switch (field) {
          case 'name':
            newThreeScaleHandler.name = value.trim();
            break;
          case 'serviceId':
            newThreeScaleHandler.serviceId = value.trim();
            break;
          case 'accessToken':
            newThreeScaleHandler.accessToken = value.trim();
            break;
          case 'systemUrl':
            newThreeScaleHandler.systemUrl = value.trim();
            break;
          default:
        }
      }
      return {
        threeScaleServiceRule: prevState.threeScaleServiceRule,
        threeScaleHandlers: prevState.threeScaleHandlers.map((handler, id) => {
          if (selectedId === id) {
            handler.modified = true;
            switch (field) {
              case 'serviceId':
                handler.serviceId = value.trim();
                break;
              case 'accessToken':
                handler.accessToken = value.trim();
                break;
              case 'systemUrl':
                handler.systemUrl = value.trim();
                break;
              default:
            }
          }
          return handler;
        }),
        newThreeScaleHandler: newThreeScaleHandler
      };
    });
  };

  onCreateHandler = () => {
    API.createThreeScaleHandler(JSON.stringify(this.state.newThreeScaleHandler))
      .then(results => {
        this.setState(
          prevState => {
            return {
              threeScaleHandlers: results.data.map(h => {
                return {
                  name: h.name,
                  serviceId: h.serviceId,
                  accessToken: h.accessToken,
                  systemUrl: h.systemUrl,
                  modified: false
                };
              }),
              threeScaleServiceRule: {
                serviceName: prevState.threeScaleServiceRule.serviceName,
                serviceNamespace: prevState.threeScaleServiceRule.serviceNamespace,
                threeScaleHandlerName: this.state.newThreeScaleHandler.name
              },
              newThreeScaleHandler: {
                name: '',
                serviceId: '',
                systemUrl: '',
                accessToken: ''
              }
            };
          },
          () => this.props.onChange(true, this.state.threeScaleServiceRule)
        );
      })
      .catch(error => {
        AlertUtils.addError('Could not create ThreeScaleHandlers.', error);
      });
  };

  onSelectHandler = (handlerName: string) => {
    this.setState(
      prevState => {
        return {
          threeScaleHandlers: prevState.threeScaleHandlers,
          threeScaleServiceRule: {
            serviceName: prevState.threeScaleServiceRule.serviceName,
            serviceNamespace: prevState.threeScaleServiceRule.serviceNamespace,
            threeScaleHandlerName: handlerName
          }
        };
      },
      () => this.props.onChange(true, this.state.threeScaleServiceRule)
    );
  };

  onHandlerToggle = id => {
    const handlersExpanded = this.state.handlersExpanded;
    const index = handlersExpanded.indexOf(id);
    const newHandlersExpanded =
      index >= 0
        ? [...handlersExpanded.slice(0, index), ...handlersExpanded.slice(index + 1, handlersExpanded.length)]
        : [...handlersExpanded, id];
    this.setState(() => ({ handlersExpanded: newHandlersExpanded }));
  };

  onActionsToggle = id => {
    const actionsToggle = this.state.actionsToggle;
    const index = actionsToggle.indexOf(id);
    const newActionsToggle =
      index >= 0
        ? [...actionsToggle.slice(0, index), ...actionsToggle.slice(index + 1, actionsToggle.length)]
        : [...actionsToggle, id];
    this.setState(() => ({ actionsToggle: newActionsToggle }));
  };

  renderHandlers = () => {
    return (
      <DataList aria-label="Select 3scale Handler">
        {this.state.threeScaleHandlers.map((handler, id) => {
          const isLinked =
            handler.name === this.state.threeScaleServiceRule.threeScaleHandlerName ||
            (this.state.threeScaleServiceRule.threeScaleHandlerName === '' && id === 0);
          return (
            <DataListItem aria-labelledby={'handler' + id} key={'handler' + id}>
              <DataListItemRow>
                <DataListToggle
                  onClick={() => this.onHandlerToggle('handler' + id)}
                  isExpanded={this.state.handlersExpanded.includes('handler' + id)}
                  id={'handler' + id}
                  aria-controls={'handler' + id}
                />
                <DataListItemCells
                  dataListCells={[
                    <DataListCell key={'handler' + id + 'icon'} isIcon={true}>
                      {isLinked && (
                        <Tooltip
                          position={TooltipPosition.top}
                          content={
                            <>
                              Service <b>{this.props.serviceName}</b> will be linked with 3scale API
                            </>
                          }
                        >
                          <Badge className={'virtualitem_badge_definition'}>3S</Badge>
                        </Tooltip>
                      )}
                    </DataListCell>,
                    <DataListCell key={'handler' + id + 'name'}>
                      {isLinked && (
                        <>
                          Service <b>{this.props.serviceName}</b> will be linked with 3scale API using{' '}
                          <b>{handler.name}</b> handler. {handler.modified && '*'}
                          <br />
                        </>
                      )}
                      {!isLinked && (
                        <>
                          Handler: <i>{handler.name}</i> {handler.modified && '*'}
                        </>
                      )}
                    </DataListCell>
                  ]}
                />
                <DataListAction
                  id={'handler' + id + 'action'}
                  aria-labelledby={'handler' + id + ' handler' + id + 'action'}
                  aria-label="Actions"
                >
                  {!isLinked && (
                    <Button variant="secondary" onClick={() => this.onSelectHandler(handler.name)}>
                      Select
                    </Button>
                  )}
                  <Dropdown
                    isPlain
                    position={DropdownPosition.right}
                    isOpen={this.state.actionsToggle.includes('handler' + id)}
                    onSelect={() => {
                      this.onActionsToggle('handler' + id);
                      this.onDeleteHandler(handler.name);
                    }}
                    toggle={<KebabToggle onToggle={() => this.onActionsToggle('handler' + id)} />}
                    dropdownItems={[<DropdownItem key="link">Remove</DropdownItem>]}
                  />
                </DataListAction>
              </DataListItemRow>
              <DataListContent
                aria-label={'handler' + id}
                id={'handler' + id + 'content'}
                isHidden={!this.state.handlersExpanded.includes('handler' + id)}
              >
                <Form isHorizontal={true}>
                  <FormGroup
                    fieldId="serviceId"
                    label="Service Id:"
                    isValid={handler.serviceId !== ''}
                    helperTextInvalid="Service Id cannot be empty"
                  >
                    <TextInput
                      id="serviceId"
                      value={handler.serviceId}
                      placeholder="3scale ID for API calls"
                      onChange={value => this.onChangeHandler(id, 'serviceId', value)}
                    />
                  </FormGroup>
                  <FormGroup
                    fieldId="systemUrl"
                    label="System Url:"
                    isValid={handler.systemUrl !== ''}
                    helperTextInvalid="System Url cannot be empty"
                  >
                    <TextInput
                      id="systemUrl"
                      value={handler.systemUrl}
                      placeholder="3scale System Url for API"
                      onChange={value => this.onChangeHandler(id, 'systemUrl', value)}
                    />
                  </FormGroup>
                  <FormGroup
                    fieldId="accessToken"
                    label="Access Token:"
                    isValid={handler.accessToken !== ''}
                    helperTextInvalid="Access Token cannot be empty"
                  >
                    <TextInput
                      id="accessToken"
                      value={handler.accessToken}
                      placeholder="3scale access token"
                      onChange={value => this.onChangeHandler(id, 'accessToken', value)}
                    />
                  </FormGroup>
                  <ActionGroup>
                    <Button
                      key="create_handler"
                      variant="secondary"
                      onClick={() => this.onUpdateHandler(id)}
                      isDisabled={
                        handler.serviceId === '' ||
                        handler.systemUrl === '' ||
                        handler.accessToken === '' ||
                        !handler.modified
                      }
                    >
                      Update Handler
                    </Button>
                  </ActionGroup>
                  <>
                    Notes:
                    <br />
                    Changes in a 3scale handler will affect to all linked services.
                  </>
                </Form>
              </DataListContent>
            </DataListItem>
          );
        })}
        {this.state.threeScaleHandlers.length === 0 && (
          <div className={noHandlerStyle}>
            No Handlers Defined. Create and Select a handler to link a Service with 3scale.
          </div>
        )}
      </DataList>
    );
  };

  isValidCreateHandler = () => {
    return (
      this.isValidK8SName(this.state.newThreeScaleHandler.name) &&
      this.state.newThreeScaleHandler.serviceId !== '' &&
      this.state.newThreeScaleHandler.systemUrl !== '' &&
      this.state.newThreeScaleHandler.accessToken !== ''
    );
  };

  isValidK8SName = (name: string) => {
    return name === '' ? false : name.search(k8sRegExpName) === 0;
  };

  renderCreateHandler = () => {
    const isValidName = this.isValidK8SName(this.state.newThreeScaleHandler.name);
    return (
      <Form isHorizontal={true}>
        <FormGroup
          fieldId="handlerName"
          label="Handler Name:"
          isValid={isValidName}
          helperTextInvalid="Name must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an alphanumeric character."
        >
          <TextInput
            id="handlerName"
            value={this.state.newThreeScaleHandler.name}
            onChange={value => this.onChangeHandler(-1, 'name', value)}
          />
        </FormGroup>
        <FormGroup
          fieldId="serviceId"
          label="Service Id:"
          isValid={this.state.newThreeScaleHandler.serviceId !== ''}
          helperTextInvalid="Service Id cannot be empty"
        >
          <TextInput
            id="serviceId"
            value={this.state.newThreeScaleHandler.serviceId}
            placeholder="3scale ID for API calls"
            onChange={value => this.onChangeHandler(-1, 'serviceId', value)}
          />
        </FormGroup>
        <FormGroup
          fieldId="systemUrl"
          label="System Url:"
          isValid={this.state.newThreeScaleHandler.systemUrl !== ''}
          helperTextInvalid="System Url cannot be empty"
        >
          <TextInput
            id="systemUrl"
            value={this.state.newThreeScaleHandler.systemUrl}
            placeholder="3scale System Url for API"
            onChange={value => this.onChangeHandler(-1, 'systemUrl', value)}
          />
        </FormGroup>
        <FormGroup
          fieldId="accessToken"
          label="Access Token:"
          isValid={this.state.newThreeScaleHandler.accessToken !== ''}
          helperTextInvalid="Access Token cannot be empty"
        >
          <TextInput
            id="accessToken"
            value={this.state.newThreeScaleHandler.accessToken}
            placeholder="3scale access token"
            onChange={value => this.onChangeHandler(-1, 'accessToken', value)}
          />
        </FormGroup>
        <ActionGroup>
          <Button
            key="create_handler"
            variant="secondary"
            onClick={this.onCreateHandler}
            isDisabled={!this.isValidCreateHandler()}
          >
            Create Handler
          </Button>
        </ActionGroup>
        <>
          Notes:
          <br />A 3scale handler defines the 3scale parameters (Service Id, System Url and Access Token) to link a
          Service with a 3scale API. A 3scale handler can be used link one to many Services with a 3scale API.
        </>
      </Form>
    );
  };

  render() {
    const isExpanded =
      this.state.threeScaleHandlers.length === 0 ||
      this.state.newThreeScaleHandler.name !== '' ||
      this.state.showCreateHandler;
    return (
      <>
        Select a 3scale handler:
        {this.renderHandlers()}
        <br />
        <Expandable
          isExpanded={isExpanded}
          toggleText={(isExpanded ? 'Hide' : 'Show') + ' Create Handler'}
          onToggle={() => {
            this.setState({
              showCreateHandler: !this.state.showCreateHandler
            });
          }}
        >
          {isExpanded && this.renderCreateHandler()}
        </Expandable>
      </>
    );
  }
}

export default ThreeScaleIntegration;
