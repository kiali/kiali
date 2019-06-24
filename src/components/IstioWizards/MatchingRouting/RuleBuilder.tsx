import * as React from 'react';
import { Button, Form, FormGroup, ListView, ListViewItem, TypeAheadSelect } from 'patternfly-react';
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

const routeStyle = style({
  marginTop: 15,
  // Yes, you are right, this is a CSS trick to adjust style on combined components
  $nest: {
    '.rbt-token .rbt-token-remove-button': {
      right: 5
    }
  }
});

const validationStyle = style({
  marginTop: 15,
  color: PfColors.Red100
});

const createStyle = style({
  marginTop: 105,
  marginLeft: 20
});

class RuleBuilder extends React.Component<Props> {
  render() {
    return (
      <ListView className={'match-routing-wizard'}>
        <ListViewItem
          key={'match-builder'}
          description={
            <>
              <>
                Matches:
                <MatchBuilder {...this.props} />
                <Matches {...this.props} />
              </>
              <div className={routeStyle}>
                Routes:
                <Form>
                  <FormGroup validationState={this.props.isValid ? 'success' : 'error'}>
                    <TypeAheadSelect
                      id="workloads-selector"
                      multiple={true}
                      clearButton={true}
                      placeholder="Select workloads"
                      labelKey="workloadName"
                      defaultSelected={this.props.routes}
                      options={this.props.workloads.map(wk => wk.name)}
                      onChange={(r: string[]) => this.props.onSelectRoutes(r)}
                    />
                  </FormGroup>
                </Form>
              </div>
              {!this.props.isValid && <div className={validationStyle}>{this.props.validationMsg}</div>}
            </>
          }
          // tslint:disable
          actions={
            <Button
              bsStyle="primary"
              className={createStyle}
              disabled={!this.props.isValid}
              onClick={this.props.onAddRule}
            >
              Add Rule
            </Button>
          }
        />
      </ListView>
    );
  }
}

export default RuleBuilder;
