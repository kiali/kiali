import * as React from 'react';
import { RuleItem } from '../../types/IstioRuleListComponent';

interface IstioRuleListDescriptionProps {
  ruleItem: RuleItem;
}

class IstioRuleListDescription extends React.Component<IstioRuleListDescriptionProps> {
  constructor(props: IstioRuleListDescriptionProps) {
    super(props);
  }

  render() {
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
      let ruleHandler: any = <span key={'_handler_' + ruleAction.handler}>{ruleAction.handler}</span>;
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
            {ruleAction.instances.sort().join(', ')}
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
