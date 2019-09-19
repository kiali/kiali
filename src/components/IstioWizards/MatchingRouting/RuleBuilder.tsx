import * as React from 'react';
import { Button, InputGroup, Select, SelectVariant, SelectOption } from '@patternfly/react-core';
import MatchBuilder from './MatchBuilder';
import Matches from './Matches';
import { style } from 'typestyle';
import { WorkloadOverview } from '../../../types/ServiceInfo';
import { PfColors } from '../../Pf/PfColors';

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
  routes: string[];
  onSelectRoutes: (routes: string[]) => void;

  // RuleBuilder
  validationMsg: string;
  onAddRule: () => void;
};

type State = {
  isWorkloadSelector: boolean;
};

const validationStyle = style({
  marginTop: 15,
  color: PfColors.Red100
});

class RuleBuilder extends React.Component<Props, State> {
  constructor(props) {
    super(props);
    this.state = {
      isWorkloadSelector: false
    };
  }

  onWorkloadsToggle = () => {
    this.setState({
      isWorkloadSelector: !this.state.isWorkloadSelector
    });
  };

  render() {
    return (
      <>
        <>
          Select Matching:
          <MatchBuilder {...this.props} />
          <Matches {...this.props} />
        </>
        <br />
        <>
          Select Routes:
          <InputGroup>
            <span id="select-workloads-id" hidden>
              Checkbox Title
            </span>
            <Select
              aria-label="Select Input"
              variant={SelectVariant.checkbox}
              onToggle={this.onWorkloadsToggle}
              onSelect={(_, selection) => {
                if (this.props.routes.includes(selection as string)) {
                  this.props.onSelectRoutes(this.props.routes.filter(item => item !== selection));
                } else {
                  this.props.onSelectRoutes([...this.props.routes, selection as string]);
                }
              }}
              onClear={() => {
                this.props.onSelectRoutes([]);
              }}
              selections={this.props.routes}
              isExpanded={this.state.isWorkloadSelector}
              placeholderText="Select workloads"
              ariaLabelledBy="select-workloads-id"
            >
              {this.props.workloads.map(wk => (
                <SelectOption key={wk.name} value={wk.name} />
              ))}
            </Select>
            <Button isDisabled={!this.props.isValid} onClick={this.props.onAddRule}>
              Add Rule
            </Button>
          </InputGroup>
          {!this.props.isValid && <div className={validationStyle}>{this.props.validationMsg}</div>}
        </>
      </>
    );
  }
}

export default RuleBuilder;
