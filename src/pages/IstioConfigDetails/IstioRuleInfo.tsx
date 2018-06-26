import * as React from 'react';
import { Button, Col, Icon, Row } from 'patternfly-react';
import IstioRuleDetailsDescription from './IstioRuleDestailsDescription';
import AceEditor from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import './IstioRuleInfo.css';
import { aceOptions, IstioRuleDetails, safeDumpOptions } from '../../types/IstioConfigDetails';

const yaml = require('js-yaml');

interface IstioRuleInfoProps {
  namespace: string;
  rule: IstioRuleDetails;
  onRefresh: () => void;
  search?: string;
}

interface ParsedSearch {
  type?: string;
  name?: string;
}

class IstioRuleInfo extends React.Component<IstioRuleInfoProps> {
  constructor(props: IstioRuleInfoProps) {
    super(props);
  }

  // Handlers and Instances have a type attached to the name with '.'
  // i.e. handler=myhandler.kubernetes
  validateParams(parsed: ParsedSearch): boolean {
    if (!parsed.type || !parsed.name || this.props.rule.actions.length === 0) {
      return false;
    }
    let validationType = ['handler', 'instance'];
    if (parsed.type && validationType.indexOf(parsed.type) < 0) {
      return false;
    }
    let splitName = parsed.name.split('.');
    if (splitName.length !== 2) {
      return false;
    }
    // i.e. handler=myhandler.kubernetes
    // innerName == myhandler
    // innerType == kubernetes
    let innerName = splitName[0];
    let innerType = splitName[1];

    for (let i = 0; i < this.props.rule.actions.length; i++) {
      if (
        parsed.type === 'handler' &&
        this.props.rule.actions[i].handler.name === innerName &&
        this.props.rule.actions[i].handler.adapter === innerType
      ) {
        return true;
      }
      if (parsed.type === 'instance') {
        for (let j = 0; j < this.props.rule.actions[i].instances.length; j++) {
          if (
            this.props.rule.actions[i].instances[j].name === innerName &&
            this.props.rule.actions[i].instances[j].template === innerType
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Helper method to extract search urls with format
  // ?handler=name.handlertype or ?instance=name.instancetype
  // Those url are expected to be received on this page.
  parseSearch(): ParsedSearch {
    let parsed: ParsedSearch = {};
    if (this.props.search) {
      let firstParams = this.props.search
        .split('&')[0]
        .replace('?', '')
        .split('=');
      parsed.type = firstParams[0];
      parsed.name = firstParams[1];
    }
    if (this.validateParams(parsed)) {
      return parsed;
    }
    if (this.props.rule.actions.length > 0) {
      let defaultAction = this.props.rule.actions[0];
      if (defaultAction.handler) {
        return {
          type: 'handler',
          name: defaultAction.handler.name + '.' + defaultAction.handler.adapter
        };
      }
    }
    return parsed;
  }

  editorContent(parsedSearch: ParsedSearch) {
    if (parsedSearch && parsedSearch.type && parsedSearch.name) {
      if (parsedSearch.type === 'handler') {
        let handler = parsedSearch.name.split('.');
        for (let i = 0; i < this.props.rule.actions.length; i++) {
          let action = this.props.rule.actions[i];
          if (action.handler.name === handler[0] && action.handler.adapter === handler[1]) {
            return yaml.safeDump(action.handler.spec, safeDumpOptions);
          }
        }
      } else if (parsedSearch.type === 'instance') {
        let instance = parsedSearch.name.split('.');
        for (let i = 0; i < this.props.rule.actions.length; i++) {
          for (let j = 0; j < this.props.rule.actions[i].instances.length; j++) {
            let actionInstance = this.props.rule.actions[i].instances[j];
            if (actionInstance.name === instance[0] && actionInstance.template === instance[1]) {
              return yaml.safeDump(actionInstance.spec, safeDumpOptions);
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
        <IstioRuleDetailsDescription
          namespace={this.props.namespace}
          name={this.props.rule.name}
          match={this.props.rule.match}
          actions={this.props.rule.actions}
        />
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col>
              <Button onClick={this.props.onRefresh} style={{ float: 'right' }}>
                <Icon name="refresh" />
              </Button>
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
