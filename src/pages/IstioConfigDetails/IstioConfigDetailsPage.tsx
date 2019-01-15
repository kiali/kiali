import * as React from 'react';
import { Breadcrumb, Button, Col, Icon, Nav, NavItem, Row, TabContainer, TabContent, TabPane } from 'patternfly-react';
import { Prompt, RouteComponentProps } from 'react-router-dom';
import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { ActiveFilter } from '../../types/Filters';
import {
  aceOptions,
  IstioConfigDetails,
  IstioConfigId,
  ParsedSearch,
  safeDumpOptions
} from '../../types/IstioConfigDetails';
import { dicIstioType } from '../../types/IstioConfigList';
import * as MessageCenter from '../../utils/MessageCenter';
import * as API from '../../services/Api';
import AceEditor from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import { authentication } from '../../utils/Authentication';
import { Validations } from '../../types/IstioObjects';
import { AceValidations, parseKialiValidations, parseYamlValidations, jsYaml } from '../../types/AceValidations';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import IstioActionDropdown from '../../components/IstioActions/IstioActionsDropdown';
import './IstioConfigDetailsPage.css';
import IstioActionButtons from '../../components/IstioActions/IstioActionsButtons';
import VirtualServiceDetail from '../ServiceDetails/ServiceInfo/IstioObjectDetails/VirtualServiceDetail';
import DestinationRuleDetail from '../ServiceDetails/ServiceInfo/IstioObjectDetails/DestinationRuleDetail';

interface IstioConfigDetailsState {
  istioObjectDetails?: IstioConfigDetails;
  istioValidations?: Validations;
  isModified: boolean;
  yamlModified?: string;
  yamlValidations?: AceValidations;
}

class IstioConfigDetailsPage extends React.Component<RouteComponentProps<IstioConfigId>, IstioConfigDetailsState> {
  aceEditorRef: React.RefObject<AceEditor>;

  constructor(props: RouteComponentProps<IstioConfigId>) {
    super(props);
    this.state = { isModified: false };
    this.aceEditorRef = React.createRef();
  }

  updateTypeFilter = () => {
    // When updateTypeFilter is called, selected filters are already updated with namespace. Just push additional type obj
    const activeFilters: ActiveFilter[] = FilterSelected.getSelected();
    activeFilters.push({
      category: 'Istio Type',
      value: dicIstioType[this.props.match.params.objectType]
    });
    FilterSelected.setSelected(activeFilters);
  };

  fetchIstioObjectDetails = () => {
    this.fetchIstioObjectDetailsFromProps(this.props.match.params);
  };

  fetchIstioObjectDetailsFromProps = (props: IstioConfigId) => {
    const promiseConfigDetails = props.objectSubtype
      ? API.getIstioConfigDetailSubtype(
          authentication(),
          props.namespace,
          props.objectType,
          props.objectSubtype,
          props.object
        )
      : API.getIstioConfigDetail(authentication(), props.namespace, props.objectType, props.object);

    // Note that adapters/templates are not supported yet for validations
    // This logic will be refactored later on KIALI-1671
    const promiseConfigValidations = API.getIstioConfigValidations(
      authentication(),
      props.namespace,
      props.objectType,
      props.object
    );
    Promise.all([promiseConfigDetails, promiseConfigValidations])
      .then(([resultConfigDetails, resultConfigValidations]) => {
        this.setState({
          istioObjectDetails: resultConfigDetails.data,
          istioValidations: resultConfigValidations.data,
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
    // Hack to force redisplay of annotations after update
    // See https://github.com/securingsincity/react-ace/issues/300
    if (this.aceEditorRef.current) {
      this.aceEditorRef.current!['editor'].onChangeAnnotation();
    }

    if (this.props.match.params !== prevProps.match.params) {
      this.fetchIstioObjectDetailsFromProps(this.props.match.params);
    }
  }

  backToList = () => {
    // Back to list page
    ListPageLink.navigateTo(TargetPage.ISTIO, [{ name: this.props.match.params.namespace }]);
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
          authentication(),
          this.props.match.params.namespace,
          this.props.match.params.objectType,
          this.props.match.params.objectSubtype,
          this.props.match.params.object
        )
      : API.deleteIstioConfigDetail(
          authentication(),
          this.props.match.params.namespace,
          this.props.match.params.objectType,
          this.props.match.params.object
        );
    deletePromise
      .then(r => this.backToList())
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not delete IstioConfig details.', error));
      });
  };

  onUpdate = () => {
    jsYaml.safeLoadAll(this.state.yamlModified, (doc: string) => {
      const jsonPatch = JSON.stringify(doc);
      const updatePromise = this.props.match.params.objectSubtype
        ? API.updateIstioConfigDetailSubtype(
            authentication(),
            this.props.match.params.namespace,
            this.props.match.params.objectType,
            this.props.match.params.objectSubtype,
            this.props.match.params.object,
            jsonPatch
          )
        : API.updateIstioConfigDetail(
            authentication(),
            this.props.match.params.namespace,
            this.props.match.params.objectType,
            this.props.match.params.object,
            jsonPatch
          );
      updatePromise
        .then(r => this.fetchIstioObjectDetails())
        .catch(error => {
          MessageCenter.add(API.getErrorMsg('Could not update IstioConfig details.', error));
        });
    });
  };

  onEditorChange = (value: string) => {
    this.setState({
      isModified: true,
      yamlModified: value,
      istioValidations: {},
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
    let istioObject;
    if (this.state.isModified) {
      return this.state.yamlModified;
    }
    if (this.state.istioObjectDetails) {
      if (this.state.istioObjectDetails.gateway) {
        istioObject = this.state.istioObjectDetails.gateway;
      } else if (this.state.istioObjectDetails.routeRule) {
        istioObject = this.state.istioObjectDetails.routeRule;
      } else if (this.state.istioObjectDetails.destinationPolicy) {
        istioObject = this.state.istioObjectDetails.destinationPolicy;
      } else if (this.state.istioObjectDetails.virtualService) {
        istioObject = this.state.istioObjectDetails.virtualService;
      } else if (this.state.istioObjectDetails.destinationRule) {
        istioObject = this.state.istioObjectDetails.destinationRule;
      } else if (this.state.istioObjectDetails.serviceEntry) {
        istioObject = this.state.istioObjectDetails.serviceEntry;
      } else if (this.state.istioObjectDetails.rule) {
        istioObject = this.state.istioObjectDetails.rule;
      } else if (this.state.istioObjectDetails.adapter) {
        istioObject = this.state.istioObjectDetails.adapter;
      } else if (this.state.istioObjectDetails.template) {
        istioObject = this.state.istioObjectDetails.template;
      } else if (this.state.istioObjectDetails.quotaSpec) {
        istioObject = this.state.istioObjectDetails.quotaSpec;
      } else if (this.state.istioObjectDetails.quotaSpecBinding) {
        istioObject = this.state.istioObjectDetails.quotaSpecBinding;
      }
    }
    return istioObject ? jsYaml.safeDump(istioObject, safeDumpOptions) : '';
  };

  renderEditor = (yamlSource: string) => {
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
            <AceEditor
              ref={this.aceEditorRef}
              mode="yaml"
              theme="eclipse"
              onChange={this.onEditorChange}
              width={'100%'}
              height={'50vh'}
              className={'istio-ace-editor'}
              readOnly={!this.canUpdate()}
              setOptions={aceOptions}
              value={yamlSource}
              annotations={editorValidations.annotations}
              markers={editorValidations.markers}
            />
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
      <IstioActionButtons
        objectName={this.props.match.params.object}
        canUpdate={this.canUpdate() && this.state.isModified && !yamlErrors}
        onCancel={this.onCancel}
        onUpdate={this.onUpdate}
      />
    );
  };

  renderRightToolbar = () => {
    const canDelete = this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
    return (
      <span style={{ float: 'right' }}>
        <Button onClick={this.onRefresh}>
          <Icon name="refresh" />
        </Button>
        &nbsp;
        <IstioActionDropdown
          objectName={this.props.match.params.object}
          canDelete={canDelete}
          onDelete={this.onDelete}
        />
      </span>
    );
  };

  renderBreadcrumbs = (): any => {
    return (
      <Breadcrumb title={true}>
        <Breadcrumb.Item componentClass={'span'}>
          <ListPageLink target={TargetPage.ISTIO}>Istio Config</ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass={'span'}>
          <ListPageLink target={TargetPage.ISTIO} namespaces={[{ name: this.props.match.params.namespace }]}>
            Namespace: {this.props.match.params.namespace}
          </ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass={'span'}>
          <ListPageLink
            target={TargetPage.ISTIO}
            namespaces={[{ name: this.props.match.params.namespace }]}
            onClick={this.updateTypeFilter}
          >
            Istio Object Type: {dicIstioType[this.props.match.params.objectType]}
          </ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item key={'breadcrumb_' + this.props.match.params.object} active={true}>
          Istio Object: {this.props.match.params.object}
        </Breadcrumb.Item>
      </Breadcrumb>
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
    if (this.state.istioObjectDetails && this.state.istioValidations) {
      if (this.state.istioObjectDetails.virtualService) {
        return (
          <VirtualServiceDetail
            virtualService={this.state.istioObjectDetails.virtualService}
            validations={this.state.istioValidations['virtualservice']}
            namespace={this.state.istioObjectDetails.namespace.name}
          />
        );
      }
      if (this.state.istioObjectDetails.destinationRule) {
        return (
          <DestinationRuleDetail
            destinationRule={this.state.istioObjectDetails.destinationRule}
            validations={this.state.istioValidations['destinationrule']}
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
          <Nav bsClass="nav nav-tabs nav-tabs-pf">
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
            <TabPane eventKey="yaml">{this.renderEditor(this.fetchYaml())}</TabPane>
          </TabContent>
        </div>
      </TabContainer>
    );
  };

  render() {
    return (
      <>
        {this.renderBreadcrumbs()}
        {this.renderRightToolbar()}
        {this.renderTabs()}
        <Prompt when={this.state.isModified} message="You have unsaved changes, are you sure you want to leave?" />
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
