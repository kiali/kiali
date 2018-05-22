import * as React from 'react';
import { RuleAction } from '../../types/IstioRuleInfo';
import { Link } from 'react-router-dom';

interface IstioRuleDetailsDescriptionProps {
  namespace: string;
  name: string;
  match: string;
  actions: RuleAction[];
}

class IstioRuleDetailsDescription extends React.Component<IstioRuleDetailsDescriptionProps> {
  constructor(props: IstioRuleDetailsDescriptionProps) {
    super(props);
  }

  render() {
    let to = '/namespaces/' + this.props.namespace + '/istio/rules/' + this.props.name;
    let ruleMatch: any = undefined;
    if (this.props.match && this.props.match.length > 0) {
      ruleMatch = (
        <div>
          <strong>Match</strong>
          {': ' + this.props.match}
        </div>
      );
    }
    let ruleActions: any = [];
    for (let j = 0; j < this.props.actions.length; j++) {
      let ruleAction = this.props.actions[j];
      let ruleHandler: any = (
        <Link
          key={to + '_handler_' + ruleAction.handler.name}
          to={{ pathname: to, search: '?handler=' + ruleAction.handler.name + '.' + ruleAction.handler.adapter }}
        >
          {ruleAction.handler.name}.{ruleAction.handler.adapter}
        </Link>
      );
      let ruleInstances: any = [];
      ruleAction.instances
        .sort((a, b) => {
          let nameCompare = a.name.localeCompare(b.name);
          if (nameCompare === 0) {
            return a.template.localeCompare(b.template);
          }
          return nameCompare;
        })
        .forEach(instance => {
          ruleInstances.push(
            <span key={to + '_instance_' + instance.name}>
              <Link to={{ pathname: to, search: '?instance=' + instance.name + '.' + instance.template }}>
                {instance.name}.{instance.template}
              </Link>{' '}
            </span>
          );
        });
      ruleActions.push(
        <div key={'rule' + j}>
          <div>
            <strong>Handler</strong>
            {': '}
            {ruleHandler}
          </div>
          <div>
            <strong>Instances</strong>
            {': '}
            {ruleInstances}
          </div>
        </div>
      );
    }
    return (
      <div>
        {ruleMatch}
        {ruleActions}
      </div>
    );
  }
}

export default IstioRuleDetailsDescription;
