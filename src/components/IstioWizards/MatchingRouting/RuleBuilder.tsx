import * as React from 'react';
import { Button, Tabs, Tab } from '@patternfly/react-core';
import MatchBuilder from './MatchBuilder';
import Matches from './Matches';
import { style } from 'typestyle';
import { WorkloadOverview } from '../../../types/ServiceInfo';
import WeightedRouting, { WorkloadWeight } from '../WeightedRouting';
import { getDefaultWeights } from '../WizardActions';

type Props = {
  // MatchBuilder props
  category: string;
  operator: string;
  headerName: string;
  matchValue: string;
  isValid: boolean;
  onSelectCategory: (category: string) => void;
  onHeaderNameChange: (headerName: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onAddMatch: () => void;

  // Matches props
  matches: string[];
  onRemoveMatch: (match: string) => void;

  workloads: WorkloadOverview[];
  onSelectWeights: (valid: boolean, workloads: WorkloadWeight[]) => void;

  // RuleBuilder
  validationMsg: string;
  onAddRule: () => void;
};

type State = {
  isWorkloadSelector: boolean;
  ruleTabKey: number;
};

const addRuleStyle = style({
  width: '100%',
  textAlign: 'right'
});

class RuleBuilder extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      isWorkloadSelector: false,
      ruleTabKey: 0
    };
  }

  onWorkloadsToggle = () => {
    this.setState({
      isWorkloadSelector: !this.state.isWorkloadSelector
    });
  };

  ruleHandleTabClick = (_event, tabIndex) => {
    this.setState({
      ruleTabKey: tabIndex
    });
  };

  render() {
    return (
      <>
        <Tabs isFilled={true} activeKey={this.state.ruleTabKey} onSelect={this.ruleHandleTabClick}>
          <Tab eventKey={0} title={'Select Matching'}>
            <div style={{ marginTop: '20px' }}>
              <MatchBuilder {...this.props} />
              <Matches {...this.props} />
            </div>
          </Tab>
          <Tab eventKey={1} title={'Select Routes'}>
            <WeightedRouting
              workloads={this.props.workloads}
              initWeights={getDefaultWeights(this.props.workloads)}
              onChange={this.props.onSelectWeights}
            />
          </Tab>
        </Tabs>
        <div className={addRuleStyle}>
          <Button variant="secondary" isDisabled={!this.props.isValid} onClick={this.props.onAddRule}>
            Add Rule
          </Button>
        </div>
      </>
    );
  }
}

export default RuleBuilder;
