import * as React from 'react';
import { Breadcrumb, Button, Col, Icon, Row } from 'patternfly-react';
import { Prompt, RouteComponentProps } from 'react-router-dom';
import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { ActiveFilter } from '../../types/Filters';
import { aceOptions, IstioConfigDetails, IstioConfigId, safeDumpOptions } from '../../types/IstioConfigDetails';
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
            {this.renderRightToolbar()}
            <h1>
              {this.props.match.params.objectType + ': ' + this.props.match.params.object}
              {this.state.isModified ? ' * ' : undefined}
            </h1>
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
    return (
      <IstioActionButtons
        objectName={this.props.match.params.object}
        canUpdate={this.canUpdate() && this.state.isModified}
        onCancel={this.backToList}
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

  render() {
    return (
      <>
        {this.renderBreadcrumbs()}
        {this.renderEditor(this.fetchYaml())}
        <Prompt when={this.state.isModified} message="You have unsaved changes, are you sure you want to leave?" />
      </>
    );
  }
}

export default IstioConfigDetailsPage;
