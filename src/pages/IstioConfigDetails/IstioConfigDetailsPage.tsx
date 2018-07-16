import * as React from 'react';
import { Button, Col, Icon, Row } from 'patternfly-react';
import { Link, RouteComponentProps } from 'react-router-dom';
import { NamespaceFilterSelected } from '../../components/NamespaceFilter/NamespaceFilter';
import { ActiveFilter } from '../../types/NamespaceFilter';
import { aceOptions, IstioConfigDetails, IstioConfigId, safeDumpOptions } from '../../types/IstioConfigDetails';
import { dicIstioType } from '../../types/IstioConfigListComponent';
import * as MessageCenter from '../../utils/MessageCenter';
import * as API from '../../services/Api';
import IstioRuleInfo from './IstioRuleInfo';
import AceEditor from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import { authentication } from '../../utils/Authentication';
import { Validations } from '../../types/ServiceInfo';
import { parseAceValidations } from '../../types/AceValidations';
import { kialiRoute } from '../../routes';

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

  updateFilters = (addObjectTypeFilter: boolean) => {
    let activeFilters: ActiveFilter[] = [];
    let namespaceFilter: ActiveFilter = {
      label: 'Namespace: ' + this.props.match.params.namespace,
      category: 'Namespace',
      value: this.props.match.params.namespace.toString()
    };
    activeFilters.push(namespaceFilter);
    if (addObjectTypeFilter) {
      let objectTypeFilter: ActiveFilter = {
        label: 'Istio Type: ' + dicIstioType[this.props.match.params.objectType],
        category: 'Istio Type',
        value: dicIstioType[this.props.match.params.objectType]
      };
      activeFilters.push(objectTypeFilter);
    }
    NamespaceFilterSelected.setSelected(activeFilters);
  };

  updateNamespaceFilter = () => this.updateFilters(false);

  updateTypeFilter = () => this.updateFilters(true);

  fetchIstioObjectDetails = () => {
    this.fetchIstioObjectDetailsFromProps(this.props.match.params);
  };

  fetchIstioObjectDetailsFromProps = (props: IstioConfigId) => {
    const promiseConfigDetails = API.getIstioConfigDetail(
      authentication(),
      props.namespace,
      props.objectType,
      props.object
    );
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
        MessageCenter.add(API.getErrorMsg('Could not fetch IstioConfig details.', error));
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

  renderEditor(routingObject: any) {
    const yamlSource = yaml.safeDump(routingObject, safeDumpOptions);
    const aceValidations = parseAceValidations(yamlSource, this.state.validations);
    return (
      <div className="container-fluid container-cards-pf">
        <Row className="row-cards-pf">
          <Col>
            <Button onClick={this.fetchIstioObjectDetails} style={{ float: 'right' }}>
              <Icon name="refresh" />
            </Button>
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
  }

  render() {
    const istioRoute = kialiRoute('/istio');
    return (
      <>
        <div className="page-header">
          <h2>
            Istio Config{' '}
            <Link to={istioRoute} onClick={this.updateNamespaceFilter}>
              {this.props.match.params.namespace}
            </Link>{' '}
            /{' '}
            <Link to={istioRoute} onClick={this.updateTypeFilter}>
              {this.props.match.params.objectType}
            </Link>{' '}
            / {this.props.match.params.object}
          </h2>
        </div>
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
        {this.state.istioObjectDetails && this.state.istioObjectDetails.rule ? (
          <IstioRuleInfo
            namespace={this.state.istioObjectDetails.namespace.name}
            rule={this.state.istioObjectDetails.rule}
            onRefresh={this.fetchIstioObjectDetails}
            search={this.props.location.search}
          />
        ) : (
          undefined
        )}
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
