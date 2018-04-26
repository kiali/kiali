import * as React from 'react';
import RuleId from '../../types/RuleId';
import { ToastNotification, ToastNotificationList, Col, Row } from 'patternfly-react';
import * as API from '../../services/Api';
import { RuleAction } from '../../types/IstioRuleInfo';
import IstioRuleDetailsDescription from './IstioRuleDestailsDescription';
import AceEditor, { AceOptions } from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import './IstioRuleInfo.css';

const yaml = require('js-yaml');

interface RuleInfoState {
  name: string;
  match: string;
  actions: RuleAction[];
  error: boolean;
  errorMessage: string;
}

interface RuleDetailsId extends RuleId {
  search?: string;
}

interface ParsedSearch {
  type?: string;
  name?: string;
}

const aceOptions: AceOptions = {
  readOnly: true,
  showPrintMargin: false,
  autoScrollEditorIntoView: true
};

class IstioRuleInfo extends React.Component<RuleDetailsId, RuleInfoState> {
  constructor(props: RuleDetailsId) {
    super(props);
    this.state = {
      name: '',
      match: '',
      actions: [],
      error: false,
      errorMessage: ''
    };
  }

  componentDidMount() {
    this.fetchIstioRuleDetails(this.props);
  }

  componentWillReceiveProps(nextProps: RuleId) {
    this.fetchIstioRuleDetails(nextProps);
  }

  fetchIstioRuleDetails(props: RuleId) {
    API.getIstioRuleDetail(props.namespace, props.rule)
      .then(response => {
        let data = response['data'];
        this.setState({
          name: data.name,
          match: data.match,
          actions: data.actions
        });
      })
      .catch(error => {
        this.setState({
          error: true,
          errorMessage: API.getErrorMsg('Could not fetch IstioRule details.', error)
        });
      });
  }

  // Helper method to extract search urls with format
  // ?handler=name or ?instance=name
  // Those url are expected to be received on this page.
  parseSearch(): ParsedSearch {
    if (this.props.search) {
      let firstParams = this.props.search
        .split('&')[0]
        .replace('?', '')
        .split('=');
      return {
        type: firstParams[0],
        name: firstParams[1]
      };
    }
    return {};
  }

  editorContent(parsedSearch: ParsedSearch) {
    if (parsedSearch && parsedSearch.type && parsedSearch.name) {
      if (parsedSearch.type === 'handler') {
        let handler = parsedSearch.name.split('.');
        for (let i = 0; i < this.state.actions.length; i++) {
          let action = this.state.actions[i];
          if (action.handler.name === handler[0] && action.handler.adapter === handler[1]) {
            return yaml.safeDump(action.handler.spec);
          }
        }
      } else if (parsedSearch.type === 'instance') {
        let instance = parsedSearch.name.split('.');
        for (let i = 0; i < this.state.actions.length; i++) {
          for (let j = 0; j < this.state.actions[i].instances.length; j++) {
            let actionInstance = this.state.actions[i].instances[j];
            if (actionInstance.name === instance[0] && actionInstance.template === instance[1]) {
              return yaml.safeDump(actionInstance.spec);
            }
          }
        }
      }
    }
    return '';
  }

  render() {
    let parsedSearch = this.parseSearch();
    return (
      <div>
        {this.state.error ? (
          <ToastNotificationList>
            <ToastNotification type="danger">
              <span>
                <strong>Error </strong>
                {this.state.errorMessage}
              </span>
            </ToastNotification>
          </ToastNotificationList>
        ) : null}
        <IstioRuleDetailsDescription
          namespace={this.props.namespace}
          name={this.state.name}
          match={this.state.match}
          actions={this.state.actions}
        />
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col>
              <h1>{parsedSearch.type + ': ' + parsedSearch.name}</h1>
              <AceEditor
                mode="yaml"
                theme="eclipse"
                readOnly={true}
                width={'100%'}
                height={'50vh'}
                className={'istio-ace-editor'}
                setOptions={aceOptions}
                value={this.editorContent(parsedSearch)}
              />
            </Col>
          </Row>
        </div>
      </div>
    );
  }
}

export default IstioRuleInfo;
