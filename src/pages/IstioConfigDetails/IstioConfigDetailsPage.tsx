import * as React from 'react';
import { Col, Nav, NavItem, Row, TabContainer, TabContent, TabPane } from 'patternfly-react';
import { Prompt, RouteComponentProps } from 'react-router-dom';
import {
  aceOptions,
  IstioConfigDetails,
  IstioConfigId,
  ParsedSearch,
  safeDumpOptions
} from '../../types/IstioConfigDetails';
import * as MessageCenter from '../../utils/MessageCenter';
import * as API from '../../services/Api';
import AceEditor from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import { ObjectValidation } from '../../types/IstioObjects';
import { AceValidations, jsYaml, parseKialiValidations, parseYamlValidations } from '../../types/AceValidations';
import IstioActionDropdown from '../../components/IstioActions/IstioActionsDropdown';
import './IstioConfigDetailsPage.css';
import { default as IstioActionButtonsContainer } from '../../components/IstioActions/IstioActionsButtons';
import BreadcrumbView from '../../components/BreadcrumbView/BreadcrumbView';
import VirtualServiceDetail from './IstioObjectDetails/VirtualServiceDetail';
import DestinationRuleDetail from './IstioObjectDetails/DestinationRuleDetail';
import history from '../../app/History';
import { Paths } from '../../config';
import { MessageType } from '../../types/MessageCenter';
import { getIstioObject, mergeJsonPatch } from '../../utils/IstioConfigUtils';
import { style } from 'typestyle';

const rightToolbarStyle = style({ float: 'right', marginTop: '8px' });
const navStyle = style({ paddingTop: '8px' });

interface IstioConfigDetailsState {
  istioObjectDetails?: IstioConfigDetails;
  istioValidations?: ObjectValidation;
  isModified: boolean;
  yamlModified?: string;
  yamlValidations?: AceValidations;
}

class IstioConfigDetailsPage extends React.Component<RouteComponentProps<IstioConfigId>, IstioConfigDetailsState> {
  aceEditorRef: React.RefObject<AceEditor>;
  promptTo: string;

  constructor(props: RouteComponentProps<IstioConfigId>) {
    super(props);
    this.state = { isModified: false };
    this.aceEditorRef = React.createRef();
    this.promptTo = '';
  }

  fetchIstioObjectDetails = () => {
    this.fetchIstioObjectDetailsFromProps(this.props.match.params);
  };

  fetchIstioObjectDetailsFromProps = (props: IstioConfigId) => {
    const promiseConfigDetails = props.objectSubtype
      ? API.getIstioConfigDetailSubtype(props.namespace, props.objectType, props.objectSubtype, props.object)
      : API.getIstioConfigDetail(props.namespace, props.objectType, props.object, true);

    // Note that adapters/templates are not supported yet for validations
    promiseConfigDetails
      .then(resultConfigDetails => {
        this.setState({
          istioObjectDetails: resultConfigDetails.data,
          istioValidations: resultConfigDetails.data.validation,
          isModified: false,
          yamlModified: ''
        });
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not fetch IstioConfig details', error));
      });
  };

  componentDidMount() {
    this.fetchIstioObjectDetails();
  }

  componentDidUpdate(prevProps: RouteComponentProps<IstioConfigId>) {
    // This will ask confirmation if we want to leave page on pending changes without save
    if (this.state.isModified) {
      window.onbeforeunload = () => true;
    } else {
      window.onbeforeunload = null;
    }
    // This will reset the flag to prevent ask multiple times the confirmation to leave with unsaved changed
    this.promptTo = '';
    // Hack to force redisplay of annotations after update
    // See https://github.com/securingsincity/react-ace/issues/300
    if (this.aceEditorRef.current) {
      // tslint:disable-next-line
      this.aceEditorRef.current!['editor'].onChangeAnnotation();
    }

    if (!this.propsMatch(prevProps)) {
      this.fetchIstioObjectDetailsFromProps(this.props.match.params);
    }
  }

  propsMatch(prevProps: RouteComponentProps<IstioConfigId>) {
    return (
      this.props.match.params.namespace === prevProps.match.params.namespace &&
      this.props.match.params.object === prevProps.match.params.object &&
      this.props.match.params.objectType === prevProps.match.params.objectType &&
      this.props.match.params.objectSubtype === prevProps.match.params.objectSubtype
    );
  }

  componentWillUnmount() {
    // Reset ask confirmation flag
    window.onbeforeunload = null;
  }

  backToList = () => {
    // Back to list page
    history.push(`/${Paths.ISTIO}?namespaces=${this.props.match.params.namespace}`);
  };

  canDelete = () => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
  };

  canUpdate = () => {
    return this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.update;
  };

  onCancel = () => {
    if (this.hasOverview()) {
      this.props.history.push(this.props.location.pathname + '?list=overview');
    } else {
      this.backToList();
    }
  };

  onDelete = () => {
    const deletePromise = this.props.match.params.objectSubtype
      ? API.deleteIstioConfigDetailSubtype(
          this.props.match.params.namespace,
          this.props.match.params.objectType,
          this.props.match.params.objectSubtype,
          this.props.match.params.object
        )
      : API.deleteIstioConfigDetail(
          this.props.match.params.namespace,
          this.props.match.params.objectType,
          this.props.match.params.object
        );
    deletePromise
      .then(_r => this.backToList())
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not delete IstioConfig details.', error));
      });
  };

  onUpdate = () => {
    jsYaml.safeLoadAll(this.state.yamlModified, (objectModified: object) => {
      const jsonPatch = JSON.stringify(mergeJsonPatch(objectModified, getIstioObject(this.state.istioObjectDetails)));
      const updatePromise = this.props.match.params.objectSubtype
        ? API.updateIstioConfigDetailSubtype(
            this.props.match.params.namespace,
            this.props.match.params.objectType,
            this.props.match.params.objectSubtype,
            this.props.match.params.object,
            jsonPatch
          )
        : API.updateIstioConfigDetail(
            this.props.match.params.namespace,
            this.props.match.params.objectType,
            this.props.match.params.object,
            jsonPatch
          );
      updatePromise
        .then(_r => {
          const targetMessage =
            this.props.match.params.namespace +
            ' / ' +
            (this.props.match.params.objectSubtype
              ? this.props.match.params.objectSubtype
              : this.props.match.params.objectType) +
            ' / ' +
            this.props.match.params.object;
          MessageCenter.add('Changes applied on ' + targetMessage, 'default', MessageType.SUCCESS);
          this.fetchIstioObjectDetails();
        })
        .catch(error => {
          MessageCenter.add(API.getErrorMsg('Could not update IstioConfig details.', error));
        });
    });
  };

  onEditorChange = (value: string) => {
    this.setState({
      isModified: true,
      yamlModified: value,
      istioValidations: {} as ObjectValidation,
      yamlValidations: parseYamlValidations(value)
    });
  };

  onRefresh = () => {
    let refresh = true;
    if (this.state.isModified) {
      refresh = window.confirm('You have unsaved changes, are you sure you want to refresh ?');
    }
    if (refresh) {
      this.fetchIstioObjectDetails();
    }
  };

  fetchYaml = () => {
    if (this.state.isModified) {
      return this.state.yamlModified;
    }
    const istioObject = getIstioObject(this.state.istioObjectDetails);
    return istioObject ? jsYaml.safeDump(istioObject, safeDumpOptions) : '';
  };

  renderEditor = () => {
    const yamlSource = this.fetchYaml();
    let editorValidations: AceValidations = {
      markers: [],
      annotations: []
    };
    if (!this.state.isModified) {
      editorValidations = parseKialiValidations(yamlSource, this.state.istioValidations);
    } else {
      if (this.state.yamlValidations) {
        editorValidations.markers = this.state.yamlValidations.markers;
        editorValidations.annotations = this.state.yamlValidations.annotations;
      }
    }

    return (
      <div className="container-fluid container-cards-pf">
        <Row className="row-cards-pf">
          <Col>
            {this.state.istioObjectDetails ? (
              <AceEditor
                ref={this.aceEditorRef}
                mode="yaml"
                theme="eclipse"
                onChange={this.onEditorChange}
                width={'100%'}
                height={'var(--kiali-yaml-editor-height)'}
                className={'istio-ace-editor'}
                readOnly={!this.canUpdate()}
                setOptions={aceOptions}
                value={this.state.istioObjectDetails ? yamlSource : undefined}
                annotations={editorValidations.annotations}
                markers={editorValidations.markers}
              />
            ) : null}
            {this.renderActionButtons()}
          </Col>
        </Row>
      </div>
    );
  };

  renderActionButtons = () => {
    // User won't save if file has yaml errors
    const yamlErrors = this.state.yamlValidations && this.state.yamlValidations.markers.length > 0 ? true : false;
    return (
      <IstioActionButtonsContainer
        objectName={this.props.match.params.object}
        readOnly={!this.canUpdate()}
        canUpdate={this.canUpdate() && this.state.isModified && !yamlErrors}
        onCancel={this.onCancel}
        onUpdate={this.onUpdate}
        onRefresh={this.onRefresh}
      />
    );
  };

  renderRightToolbar = () => {
    const canDelete = this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
    const istioObject = getIstioObject(this.state.istioObjectDetails);

    return (
      <span className={rightToolbarStyle}>
        <IstioActionDropdown
          objectKind={istioObject ? istioObject.kind : undefined}
          objectName={this.props.match.params.object}
          canDelete={canDelete}
          onDelete={this.onDelete}
        />
      </span>
    );
  };

  // Not all Istio types have components to render an overview tab
  hasOverview = (): boolean => {
    return (
      this.props.match.params.objectType === 'virtualservices' ||
      this.props.match.params.objectType === 'destinationrules'
    );
  };

  renderOverview = (): any => {
    if (this.state.istioObjectDetails) {
      if (this.state.istioObjectDetails.virtualService) {
        return (
          <VirtualServiceDetail
            virtualService={this.state.istioObjectDetails.virtualService}
            validation={this.state.istioValidations}
            namespace={this.state.istioObjectDetails.namespace.name}
          />
        );
      }
      if (this.state.istioObjectDetails.destinationRule) {
        return (
          <DestinationRuleDetail
            destinationRule={this.state.istioObjectDetails.destinationRule}
            validation={this.state.istioValidations}
            namespace={this.state.istioObjectDetails.namespace.name}
          />
        );
      }
    } else {
      // In theory it shouldn't enter here
      return <div>{this.props.match.params.object} has not been loaded</div>;
    }
  };

  renderTabs = (): any => {
    return (
      <TabContainer
        id="basic-tabs"
        activeKey={this.activeTab('list', this.hasOverview() ? 'overview' : 'yaml')}
        onSelect={this.tabSelectHandler('list')}
      >
        <div>
          <Nav bsClass={`nav nav-tabs nav-tabs-pf ${navStyle}`}>
            {this.hasOverview() ? (
              <NavItem eventKey="overview">
                <div>Overview</div>
              </NavItem>
            ) : null}
            <NavItem eventKey="yaml">
              <div>YAML {this.state.isModified ? ' * ' : undefined}</div>
            </NavItem>
          </Nav>
          <TabContent>
            {this.hasOverview() ? (
              <TabPane eventKey="overview" mountOnEnter={true} unmountOnExit={true}>
                {this.renderOverview()}
              </TabPane>
            ) : null}
            <TabPane eventKey="yaml">{this.renderEditor()}</TabPane>
          </TabContent>
        </div>
      </TabContainer>
    );
  };

  render() {
    return (
      <>
        <BreadcrumbView location={this.props.location} />
        {this.renderRightToolbar()}
        {this.renderTabs()}
        <Prompt
          message={location => {
            if (this.state.isModified) {
              // Check if Prompt is invoked multiple times
              if (this.promptTo === location.pathname) {
                return true;
              }
              this.promptTo = location.pathname;
              return 'You have unsaved changes, are you sure you want to leave?';
            }
            return true;
          }}
        />
      </>
    );
  }

  private activeTab = (tabNameParam: string, whenEmpty: string) => {
    return new URLSearchParams(this.props.location.search).get(tabNameParam) || whenEmpty;
  };

  // Helper method to extract search urls with format
  // ?list=overview or ?list=yaml
  private parseSearch = (): ParsedSearch => {
    const parsed: ParsedSearch = {};
    if (this.props.location.search) {
      const firstParams = this.props.location.search
        .split('&')[0]
        .replace('?', '')
        .split('=');
      parsed.type = firstParams[0];
      parsed.name = firstParams[1];
    }
    return {};
  };

  private tabSelectHandler = (tabNameParam: string) => {
    return (tabKey?: string) => {
      if (!tabKey) {
        return;
      }

      const urlParams = new URLSearchParams('');
      const parsedSearch = this.parseSearch();
      if (parsedSearch.type && parsedSearch.name) {
        urlParams.set(parsedSearch.type, parsedSearch.name);
      }
      urlParams.set(tabNameParam, tabKey);
      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };
  };
}

export default IstioConfigDetailsPage;
