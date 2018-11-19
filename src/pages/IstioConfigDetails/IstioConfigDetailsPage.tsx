import * as React from 'react';
import { Breadcrumb, Button, Col, Icon, Row } from 'patternfly-react';
import { RouteComponentProps } from 'react-router-dom';
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
import { parseAceValidations } from '../../types/AceValidations';
import { ListPageLink, TargetPage } from '../../components/ListPage/ListPageLink';
import IstioActionDropdown from '../../components/IstioActions/IstioActionsDropdown';
import './IstioConfigDetailsPage.css';

const yaml = require('js-yaml');

interface IstioConfigDetailsState {
  istioObjectDetails?: IstioConfigDetails;
  validations?: Validations;
}

class IstioConfigDetailsPage extends React.Component<RouteComponentProps<IstioConfigId>, IstioConfigDetailsState> {
  aceEditorRef: React.RefObject<AceEditor>;

  constructor(props: RouteComponentProps<IstioConfigId>) {
    super(props);
    this.state = {};
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
    // This logic will be refactored later on KIALI-
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
          validations: resultConfigValidations.data
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
    // Hack to force redisplay of annotations after update
    // See https://github.com/securingsincity/react-ace/issues/300
    if (this.aceEditorRef.current) {
      this.aceEditorRef.current!['editor'].onChangeAnnotation();
    }

    if (this.props.match.params !== prevProps.match.params) {
      this.fetchIstioObjectDetailsFromProps(this.props.match.params);
    }
  }

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
      .then(r => {
        // Back to list page
        ListPageLink.navigateTo(TargetPage.ISTIO, this.props.match.params.namespace);
      })
      .catch(error => {
        MessageCenter.add(API.getErrorMsg('Could not delete IstioConfig details.', error));
      });
  };

  renderEditor = (routingObject: any) => {
    const yamlSource = yaml.safeDump(routingObject, safeDumpOptions);
    const aceValidations = parseAceValidations(yamlSource, this.state.validations);
    return (
      <div className="container-fluid container-cards-pf">
        <Row className="row-cards-pf">
          <Col>
            {this.renderRightToolbar()}
            <h1>{this.props.match.params.objectType + ': ' + this.props.match.params.object}</h1>
            <AceEditor
              ref={this.aceEditorRef}
              mode="yaml"
              theme="eclipse"
              readOnly={true}
              width={'100%'}
              height={'50vh'}
              className={'istio-ace-editor'}
              setOptions={aceOptions}
              value={yamlSource}
              annotations={aceValidations.annotations}
              markers={aceValidations.markers}
            />
          </Col>
        </Row>
      </div>
    );
  };

  renderRightToolbar = () => {
    const canDelete = this.state.istioObjectDetails !== undefined && this.state.istioObjectDetails.permissions.delete;
    return (
      <span style={{ float: 'right' }}>
        <Button onClick={this.fetchIstioObjectDetails}>
          <Icon name="refresh" />
        </Button>&nbsp;
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
          <ListPageLink target={TargetPage.ISTIO} namespace={this.props.match.params.namespace}>
            Namespace: {this.props.match.params.namespace}
          </ListPageLink>
        </Breadcrumb.Item>
        <Breadcrumb.Item componentClass={'span'}>
          <ListPageLink
            target={TargetPage.ISTIO}
            namespace={this.props.match.params.namespace}
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
        {this.state.istioObjectDetails && this.state.istioObjectDetails.gateway
          ? this.renderEditor(this.state.istioObjectDetails.gateway)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.routeRule
          ? this.renderEditor(this.state.istioObjectDetails.routeRule)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.destinationPolicy
          ? this.renderEditor(this.state.istioObjectDetails.destinationPolicy)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.virtualService
          ? this.renderEditor(this.state.istioObjectDetails.virtualService)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.destinationRule
          ? this.renderEditor(this.state.istioObjectDetails.destinationRule)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.serviceEntry
          ? this.renderEditor(this.state.istioObjectDetails.serviceEntry)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.rule
          ? this.renderEditor(this.state.istioObjectDetails.rule)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.adapter
          ? this.renderEditor(this.state.istioObjectDetails.adapter)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.template
          ? this.renderEditor(this.state.istioObjectDetails.template)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.quotaSpec
          ? this.renderEditor(this.state.istioObjectDetails.quotaSpec)
          : undefined}
        {this.state.istioObjectDetails && this.state.istioObjectDetails.quotaSpecBinding
          ? this.renderEditor(this.state.istioObjectDetails.quotaSpecBinding)
          : undefined}
      </>
    );
  }
}

export default IstioConfigDetailsPage;
