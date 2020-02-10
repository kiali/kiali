import * as React from 'react';
import { ThreeScaleHandler, ThreeScaleServiceRule } from '../../types/ThreeScale';
import {
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
  Form,
  FormGroup,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { style } from 'typestyle';
import * as API from '../../services/Api';
import * as AlertUtils from '../../utils/AlertUtils';
import { PfColors } from '../Pf/PfColors';
import { Link } from 'react-router-dom';

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
                    {handler.serviceId}
                  </FormGroup>
                  <FormGroup
                    fieldId="systemUrl"
                    label="System Url:"
                    isValid={handler.systemUrl !== ''}
                    helperTextInvalid="System Url cannot be empty"
                  >
                    {handler.systemUrl}
                  </FormGroup>
                  <FormGroup
                    fieldId="accessToken"
                    label="Access Token:"
                    isValid={handler.accessToken !== ''}
                    helperTextInvalid="Access Token cannot be empty"
                  >
                    {handler.accessToken}
                  </FormGroup>
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

  render() {
    return (
      <>
        Select a 3scale handler:
        {this.renderHandlers()}
        <br />
        {this.state.threeScaleHandlers.length !== 0 ? (
          <Link to={`/extensions/threescale`} key={'ThreeScaleHandlersLink'}>
            View 3scale Handlers
          </Link>
        ) : (
          <Link to={`/extensions/threescale/new`} key={'ThreeScaleHandlersNewLink'}>
            Create New 3scale Handler
          </Link>
        )}
      </>
    );
  }
}

export default ThreeScaleIntegration;
