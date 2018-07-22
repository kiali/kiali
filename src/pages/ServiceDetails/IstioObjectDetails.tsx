import * as React from 'react';
import { DestinationRule, Validations, VirtualService } from '../../types/ServiceInfo';
import { Col, Nav, NavItem, Row, TabContainer, TabContent, TabPane } from 'patternfly-react';
import { AceValidations, parseAceValidations } from '../../types/AceValidations';
import AceEditor, { AceOptions } from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import VirtualServiceDetail from './ServiceInfo/IstioObjectDetails/VirtualServiceDetail';
import './ServiceInfo/IstioObjectDetails/IstioObjectDetails.css';
import { Link } from 'react-router-dom';

const yaml = require('js-yaml');

const safeDumpOptions = {
  styles: {
    '!!null': 'canonical' // dump null as ~
  }
};

const aceOptions: AceOptions = {
  readOnly: true,
  showPrintMargin: false,
  autoScrollEditorIntoView: true
};

type IstioObjectDetailsProps = {
  object: VirtualService | DestinationRule;
  validations: Validations;
  onSelectTab: (tabName: string, tabKey?: string) => void;
  activeTab: (tabName: string, whenEmpty: string) => string;
  servicePageURL: string;
};

type IstioObjectDetailsState = {
  aceValidations: AceValidations;
  validationsParsed: boolean;
  yamlEditor: string;
};

export default class IstioObjectDetails extends React.Component<IstioObjectDetailsProps, IstioObjectDetailsState> {
  constructor(props: IstioObjectDetailsProps) {
    super(props);
    this.state = {
      yamlEditor: '',
      validationsParsed: false,
      aceValidations: {
        markers: [],
        annotations: []
      }
    };
  }

  markers() {
    return this.aceValidations().markers;
  }

  annotations() {
    return this.aceValidations().annotations;
  }

  aceValidations() {
    if (!this.state.validationsParsed) {
      this.setState({
        aceValidations: parseAceValidations(this.yamlEditor(), this.props.validations),
        validationsParsed: true
      });
    }

    return this.state.aceValidations;
  }

  yamlEditor() {
    let yamlEditor = this.state.yamlEditor;

    if (!yamlEditor) {
      yamlEditor = yaml.safeDump(this.props.object, safeDumpOptions);
    }

    return yamlEditor;
  }

  editorTab() {
    return (
      <TabPane eventKey="yaml">
        <div className="card-pf">
          <Row className={'card-pf-body'} key={'virtualservice-yaml'}>
            <Col xs={12}>
              <div className={'pull-right'}>
                <Link to={{ pathname: this.props.servicePageURL }}>Back to Service</Link>{' '}
              </div>
              <AceEditor
                mode="yaml"
                theme="eclipse"
                readOnly={true}
                width={'100%'}
                height={'50vh'}
                className={'istio-ace-editor'}
                setOptions={aceOptions}
                value={this.yamlEditor()}
                markers={this.markers()}
                annotations={this.annotations()}
              />
            </Col>
          </Row>
        </div>
      </TabPane>
    );
  }

  typeIstioObject() {
    if ('tcp' in this.props.object && 'http' in this.props.object) {
      return 'VirtualService';
    }
    return 'DestinationRule';
  }

  overviewTab() {
    const istioObj: VirtualService | DestinationRule = this.props.object as VirtualService | DestinationRule;
    if (this.typeIstioObject() === 'VirtualService') {
      return (
        <TabPane eventKey="overview">
          <VirtualServiceDetail virtualService={istioObj} validations={this.props.validations['virtualservice']} />
        </TabPane>
      );
    }
    return;
  }

  renderTabNav() {
    return (
      <>
        <Nav bsClass="nav nav-tabs nav-tabs-pf">
          {this.typeIstioObject() === 'VirtualService' && (
            <NavItem eventKey="overview">
              <div>Overview</div>
            </NavItem>
          )}
          <NavItem eventKey="yaml">
            <div>YAML</div>
          </NavItem>
        </Nav>
      </>
    );
  }

  render() {
    return (
      <div className="container-fluid container-cards-pf">
        <Row className="row-cards-pf">
          <Col>
            <TabContainer
              id="basic-tabs"
              activeKey={this.props.activeTab('detail', 'overview')}
              onSelect={this.istioDetailTabSelectHandler}
            >
              <>
                {this.renderTabNav()}
                <TabContent>
                  {this.overviewTab()}
                  {this.editorTab()}
                </TabContent>
              </>
            </TabContainer>
          </Col>
        </Row>
      </div>
    );
  }

  private istioDetailTabSelectHandler = (tabKey?: string) => {
    this.props.onSelectTab('detail', tabKey);
  };
}
