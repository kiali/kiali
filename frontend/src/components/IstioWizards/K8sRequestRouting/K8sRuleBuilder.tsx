import * as React from 'react';
import { Button, Tabs, Tab, ButtonVariant } from '@patternfly/react-core';
import K8sMatchBuilder from './K8sMatchBuilder';
import K8sMatches from './K8sMatches';
import { style } from 'typestyle';
import { PFColors } from '../../Pf/PfColors';
import K8sTrafficShifting, { K8sRouteBackendRef } from '../K8sTrafficShifting';
import {ServiceOverview} from "../../../types/ServiceList";
import K8sFilterBuilder from "./K8sFilterBuilder";
import K8sFilters from "./K8sFilters";

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
  onMatchHeaderNameChange: (headerName: string) => void;
  onQueryParamNameChange: (matchValue: string) => void;
  onSelectOperator: (operator: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onAddMatch: () => void;

  // K8sMatches props
  matches: string[];
  onRemoveMatch: (match: string) => void;

  // K8sFilters props
  filterType: string;
  filterValue: string;
  headerOp: string;
  schemeOp: string;
  headerValue: string;
  hostName: string;
  portValue: string;
  serviceOp: string;
  statusCodeOp: string;
  filters: string[];
  onSelectFilterType: (filterType: string) => void;
  onHeaderValueChange: (headerValue: string) => void;
  onHostNameChange: (hostName: string) => void;
  onPortValueChange: (portValue: string) => void;
  onSelectServiceOp: (serviceOp: string) => void;
  onSelectStatusCodeOp: (statusCodeOp: string) => void;
  onSelectHeaderOp: (headerOp: string) => void;
  onSelectSchemeOp: (schemeOp: string) => void;
  onRemoveFilter: (filter: string) => void;
  onAddFilter: () => void;

  subServices: ServiceOverview[];
  onSelectWeights: (backendRefs: K8sRouteBackendRef[]) => void;

  backendRefs: K8sRouteBackendRef[];

  // K8sRuleBuilder
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
          <Tab eventKey={1} title={'Route To'} data-test={'Route To'}>
            <div
              style={{
                marginBottom: '10px'
              }}
            >
              <K8sTrafficShifting
                showValid={false}
                subServices={this.props.subServices}
                initRefs={this.props.backendRefs}
                onChange={this.props.onSelectWeights}
              />
            </div>
          </Tab>
          <Tab eventKey={2} title={'Route Filtering'} data-test={'Route Filtering'}>
            <div style={{ marginTop: '20px' }}>
              <K8sFilterBuilder {...this.props} />
              <K8sFilters {...this.props} />
            </div>
          </Tab>
        </Tabs>
        <div className={addRuleStyle}>
          <span>
            {this.props.validationMsg.length > 0 && <div className={validationStyle}>{this.props.validationMsg}</div>}
            <Button
              variant={ButtonVariant.secondary}
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
