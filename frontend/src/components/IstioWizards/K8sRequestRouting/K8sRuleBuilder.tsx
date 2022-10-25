import * as React from 'react';
import { Button, Tabs, Tab, ButtonVariant } from '@patternfly/react-core';
import K8sMatchBuilder from './K8sMatchBuilder';
import K8sMatches from './K8sMatches';
import { style } from 'typestyle';
import { WorkloadOverview } from '../../../types/ServiceInfo';
import { PFColors } from '../../Pf/PfColors';

type Props = {
  // K8sMatchBuilder props
  category: string;
  operator: string;
  headerName: string;
  queryParamName: string;
  matchValue: string;
  isValid: boolean;
  onSelectCategory: (category: string) => void;
  onHeaderNameChange: (headerName: string) => void;
  onQueryParamNameChange: (matchValue: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onAddMatch: () => void;

  // K8sMatches props
  matches: string[];
  onRemoveMatch: (match: string) => void;

  workloads: WorkloadOverview[];
  backendRefs: K8sRouteBackendRef[];

  // K8sRuleBuilder
  validationMsg: string;
  onAddRule: () => void;
};

export type K8sRouteBackendRef = {
  name: string;
  weight?: number;
  port?: number;
};

type State = {
  isWorkloadSelector: boolean;
  ruleTabKey: number;
};

const addRuleStyle = style({
  width: '100%',
  textAlign: 'right'
});

const validationStyle = style({
  marginRight: 20,
  color: PFColors.Red100,
  display: 'inline'
});

class K8sRuleBuilder extends React.Component<Props, State> {
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
          <Tab eventKey={0} title={'Request Matching'} data-test={'Request Matching'}>
            <div style={{ marginTop: '20px' }}>
              <K8sMatchBuilder {...this.props} />
              <K8sMatches {...this.props} />
            </div>
          </Tab>
        </Tabs>
        <div className={addRuleStyle}>
          <span>
            {this.props.validationMsg.length > 0 && <div className={validationStyle}>{this.props.validationMsg}</div>}
            <Button
              variant={ButtonVariant.secondary}
              isDisabled={!this.props.isValid}
              onClick={this.props.onAddRule}
              data-test="add-route"
            >
              Add Route Rule
            </Button>
          </span>
        </div>
      </>
    );
  }
}

export default K8sRuleBuilder;
