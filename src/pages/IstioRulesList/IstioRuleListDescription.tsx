import * as React from 'react';
import { RuleItem } from '../../types/IstioRuleListComponent';
import { Link } from 'react-router-dom';

interface IstioRuleListDescriptionProps {
  ruleItem: RuleItem;
}

class IstioRuleListDescription extends React.Component<IstioRuleListDescriptionProps> {
  constructor(props: IstioRuleListDescriptionProps) {
    super(props);
  }

  render() {
    let to = '/namespaces/' + this.props.ruleItem.namespace + '/rules/' + this.props.ruleItem.name;
    let ruleMatch: any = undefined;
    if (this.props.ruleItem.match && this.props.ruleItem.match.length > 0) {
      ruleMatch = (
        <div>
          <strong>Match</strong>
          {': ' + this.props.ruleItem.match}
        </div>
      );
    }
    let ruleActions: any = [];
    for (let j = 0; j < this.props.ruleItem.actions.length; j++) {
      let ruleAction = this.props.ruleItem.actions[j];
      let ruleHandler: any = (
        <Link
          key={to + '_handler_' + ruleAction.handler}
          to={{ pathname: to, search: '?handler=' + ruleAction.handler }}
        >
          {ruleAction.handler}
        </Link>
      );
      let ruleInstances: any = [];
      ruleAction.instances.sort().forEach(instance => {
        ruleInstances.push(
          <span key={to + '_instance_' + instance}>
            <Link to={{ pathname: to, search: '?instance=' + instance }}>{instance}</Link>{' '}
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

export default IstioRuleListDescription;
