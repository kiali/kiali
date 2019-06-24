import * as React from 'react';
import { ThreeScaleHandler, ThreeScaleServiceRule } from '../../types/ThreeScale';
import {
  Button,
  Col,
  ControlLabel,
  DropdownKebab,
  ExpandCollapse,
  Form,
  FormControl,
  FormGroup,
  HelpBlock,
  ListView,
  ListViewIcon,
  ListViewItem,
  MenuItem,
  OverlayTrigger,
  Tooltip,
  Row
} from 'patternfly-react';
import { style } from 'typestyle';
import * as API from '../../services/Api';
import * as MessageCenter from '../../utils/MessageCenter';

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
};

const expandStyle = style({
  marginTop: 20,
  $nest: {
    '.btn': {
      fontSize: '14px'
    }
  }
});

const createHandlerStyle = style({
  marginTop: 20
});

const headingStyle = style({
  fontWeight: 'normal',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis'
});

const k8sRegExpName = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?(\.[-a-z0-9]([-a-z0-9]*[a-z0-9])?)*$/;

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
      }
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
        MessageCenter.add(API.getErrorMsg('Could not fetch ThreeScaleHandlers', error));
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
        MessageCenter.add(API.getErrorMsg('Could not update ThreeScaleHandlers', error));
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
        MessageCenter.add(API.getErrorMsg('Could not delete ThreeScaleHandlers', error));
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
        MessageCenter.add(API.getErrorMsg('Could not create ThreeScaleHandlers', error));
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

  renderHandlers = () => {
    return (
      <ListView>
        {this.state.threeScaleHandlers.map((handler, id) => {
          const isLinked =
            handler.name === this.state.threeScaleServiceRule.threeScaleHandlerName ||
            (this.state.threeScaleServiceRule.threeScaleHandlerName === '' && id === 0);
          const handlerActions = (
            <>
              {!isLinked && <Button onClick={() => this.onSelectHandler(handler.name)}>Select</Button>}
              <DropdownKebab key={'delete-handler-actions-' + id} id={'delete-handler-actions-' + id} pullRight={true}>
                <MenuItem onClick={() => this.onDeleteHandler(handler.name)}>Delete Handler</MenuItem>
              </DropdownKebab>
            </>
          );
          const leftContent = isLinked ? <ListViewIcon type="pf" name="connected" /> : undefined;

          return (
            <ListViewItem
              key={id}
              leftContent={leftContent}
              heading={
                <>
                  <div>
                    {handler.name} {handler.modified && '*'}
                  </div>
                  <div className={headingStyle}>3scale Handler</div>
                </>
              }
              description={
                <>
                  {isLinked && (
                    <>
                      Service <b>{this.props.serviceName}</b> will be linked with 3scale API
                    </>
                  )}
                  <br />
                  Service Id: <i>{handler.serviceId}</i>
                  <br />
                  System Url: <i>{handler.systemUrl}</i>
                </>
              }
              actions={handlerActions}
            >
              <Form horizontal={true}>
                <FormGroup
                  controlId="serviceId"
                  disabled={false}
                  validationState={handler.serviceId !== '' ? 'success' : 'error'}
                >
                  <Col componentClass={ControlLabel} sm={2}>
                    Service Id:
                  </Col>
                  <Col sm={8}>
                    <OverlayTrigger
                      placement={'right'}
                      overlay={<Tooltip id={'mtls-status-masthead'}>3scale ID for API calls</Tooltip>}
                      trigger={['hover', 'focus']}
                      rootClose={false}
                    >
                      <FormControl
                        type="text"
                        disabled={false}
                        value={handler.serviceId}
                        onChange={e => this.onChangeHandler(id, 'serviceId', e.target.value)}
                      />
                    </OverlayTrigger>
                  </Col>
                </FormGroup>
                <FormGroup
                  controlId="systemUrl"
                  disabled={false}
                  validationState={handler.systemUrl !== '' ? 'success' : 'error'}
                >
                  <Col componentClass={ControlLabel} sm={2}>
                    System Url:
                  </Col>
                  <Col sm={8}>
                    <OverlayTrigger
                      placement={'right'}
                      overlay={<Tooltip id={'mtls-status-masthead'}>3scale System Url for API</Tooltip>}
                      trigger={['hover', 'focus']}
                      rootClose={false}
                    >
                      <FormControl
                        type="text"
                        disabled={false}
                        value={handler.systemUrl}
                        onChange={e => this.onChangeHandler(id, 'systemUrl', e.target.value)}
                      />
                    </OverlayTrigger>
                  </Col>
                </FormGroup>
                <FormGroup
                  controlId="accessToken"
                  disabled={false}
                  validationState={handler.accessToken !== '' ? 'success' : 'error'}
                >
                  <Col componentClass={ControlLabel} sm={2}>
                    Access Token:
                  </Col>
                  <Col sm={8}>
                    <OverlayTrigger
                      placement={'right'}
                      overlay={<Tooltip id={'mtls-status-masthead'}>3scale access token</Tooltip>}
                      trigger={['hover', 'focus']}
                      rootClose={false}
                    >
                      <FormControl
                        type="text"
                        disabled={false}
                        value={handler.accessToken}
                        onChange={e => this.onChangeHandler(id, 'accessToken', e.target.value)}
                      />
                    </OverlayTrigger>
                  </Col>
                </FormGroup>
                <Row style={{ paddingTop: '10px', paddingBottom: '10px' }}>
                  <Col smOffset={10} sm={2}>
                    <Button
                      bsStyle="primary"
                      style={{ marginLeft: '-10px' }}
                      onClick={() => this.onUpdateHandler(id)}
                      disabled={handler.serviceId === '' || handler.systemUrl === '' || handler.accessToken === ''}
                    >
                      Update Handler
                    </Button>
                  </Col>
                </Row>
              </Form>
            </ListViewItem>
          );
        })}
      </ListView>
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
      <Form className={createHandlerStyle} horizontal={true}>
        <FormGroup
          controlId="handlerName"
          disabled={false}
          value={this.state.newThreeScaleHandler.name}
          onChange={e => this.onChangeHandler(-1, 'name', e.target.value)}
          validationState={isValidName ? 'success' : 'error'}
        >
          <Col componentClass={ControlLabel} sm={2}>
            Handler Name:
          </Col>
          <Col sm={8}>
            <FormControl type="text" disabled={false} />
            {!isValidName && (
              <HelpBlock>
                Name must consist of lower case alphanumeric characters, '-' or '.', and must start and end with an
                alphanumeric character.
              </HelpBlock>
            )}
          </Col>
        </FormGroup>
        <FormGroup
          controlId="serviceId"
          disabled={false}
          value={this.state.newThreeScaleHandler.serviceId}
          onChange={e => this.onChangeHandler(-1, 'serviceId', e.target.value)}
          validationState={this.state.newThreeScaleHandler.serviceId !== '' ? 'success' : 'error'}
        >
          <Col componentClass={ControlLabel} sm={2}>
            Service Id:
          </Col>
          <Col sm={8}>
            <OverlayTrigger
              placement={'right'}
              overlay={<Tooltip id={'mtls-status-masthead'}>3scale ID for API calls</Tooltip>}
              trigger={['hover', 'focus']}
              rootClose={false}
            >
              <FormControl type="text" disabled={false} />
            </OverlayTrigger>
          </Col>
        </FormGroup>
        <FormGroup
          controlId="systemUrl"
          disabled={false}
          value={this.state.newThreeScaleHandler.systemUrl}
          onChange={e => this.onChangeHandler(-1, 'systemUrl', e.target.value)}
          validationState={this.state.newThreeScaleHandler.systemUrl !== '' ? 'success' : 'error'}
        >
          <Col componentClass={ControlLabel} sm={2}>
            System Url:
          </Col>
          <Col sm={8}>
            <OverlayTrigger
              placement={'right'}
              overlay={<Tooltip id={'mtls-status-masthead'}>3scale System Url for API</Tooltip>}
              trigger={['hover', 'focus']}
              rootClose={false}
            >
              <FormControl type="text" disabled={false} />
            </OverlayTrigger>
          </Col>
        </FormGroup>
        <FormGroup
          controlId="accessToken"
          disabled={false}
          value={this.state.newThreeScaleHandler.accessToken}
          onChange={e => this.onChangeHandler(-1, 'accessToken', e.target.value)}
          validationState={this.state.newThreeScaleHandler.accessToken !== '' ? 'success' : 'error'}
        >
          <Col componentClass={ControlLabel} sm={2}>
            Access Token:
          </Col>
          <Col sm={8}>
            <OverlayTrigger
              placement={'right'}
              overlay={<Tooltip id={'mtls-status-masthead'}>3scale access token</Tooltip>}
              trigger={['hover', 'focus']}
              rootClose={false}
            >
              <FormControl type="text" disabled={false} />
            </OverlayTrigger>
          </Col>
        </FormGroup>
        <Row style={{ paddingTop: '10px', paddingBottom: '10px' }}>
          <Col smOffset={10} sm={2}>
            <Button bsStyle="primary" onClick={this.onCreateHandler} disabled={!this.isValidCreateHandler()}>
              Create Handler
            </Button>
          </Col>
        </Row>
      </Form>
    );
  };

  render() {
    return (
      <>
        {this.renderHandlers()}
        <ExpandCollapse
          className={expandStyle}
          textCollapsed="Show Advanced Options"
          textExpanded="Hide Advanced Options"
          expanded={this.state.threeScaleHandlers.length === 0 || this.state.newThreeScaleHandler.name !== ''}
        >
          {this.renderCreateHandler()}
        </ExpandCollapse>
      </>
    );
  }
}

export default ThreeScaleIntegration;
