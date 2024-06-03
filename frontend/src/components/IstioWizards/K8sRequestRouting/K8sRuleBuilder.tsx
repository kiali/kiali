import * as React from 'react';
import { Button, Tabs, Tab, ButtonVariant } from '@patternfly/react-core';
import { K8sMatchBuilder } from './K8sMatchBuilder';
import { K8sMatches } from './K8sMatches';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../Pf/PfColors';
import { K8sTrafficShifting, K8sRouteBackendRef } from '../K8sTrafficShifting';
import { ServiceOverview } from '../../../types/ServiceList';
import { K8sFilterBuilder } from './K8sFilterBuilder';
import { K8sFilters } from './K8sFilters';

type Props = {
  // K8sRuleBuilder props
  backendRefs: K8sRouteBackendRef[];
  category: string;
  filterType: string;
  filterValue: string;
  filters: string[];
  headerName: string;
  headerOp: string;
  headerValue: string;
  hostName: string;
  isValid: boolean;
  matchValue: string;
  matches: string[];
  onAddFilter: () => void;
  onAddMatch: () => void;
  onAddRule: () => void;
  onHeaderNameChange: (headerName: string) => void;
  onHeaderValueChange: (headerValue: string) => void;
  onHostNameChange: (hostName: string) => void;
  onMatchHeaderNameChange: (headerName: string) => void;
  onMatchValueChange: (matchValue: string) => void;
  onPortValueChange: (portValue: string) => void;
  onQueryParamNameChange: (matchValue: string) => void;
  onRemoveFilter: (filter: string) => void;
  onRemoveMatch: (match: string) => void;
  onSelectCategory: (category: string) => void;
  onSelectFilterType: (filterType: string) => void;
  onSelectHeaderOp: (headerOp: string) => void;
  onSelectOperator: (operator: string) => void;
  onSelectSchemeOp: (schemeOp: string) => void;
  onSelectServiceOp: (serviceOp: string) => void;
  onSelectStatusCodeOp: (statusCodeOp: string) => void;
  onSelectWeights: (backendRefs: K8sRouteBackendRef[]) => void;
  operator: string;
  portValue: string;
  protocol: string;
  queryParamName: string;
  schemeOp: string;
  serviceOp: string;
  statusCodeOp: string;
  subServices: ServiceOverview[];
  validationMsg: string;
};

type State = {
  isWorkloadSelector: boolean;
  ruleTabKey: number;
};

const addRuleStyle = kialiStyle({
  width: '100%',
  textAlign: 'right'
});

const validationStyle = kialiStyle({
  marginRight: 20,
  color: PFColors.Red100,
  display: 'inline'
});

export class K8sRuleBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      isWorkloadSelector: false,
      ruleTabKey: 0
    };
  }

  onWorkloadsToggle = (): void => {
    this.setState({
      isWorkloadSelector: !this.state.isWorkloadSelector
    });
  };

  ruleHandleTabClick = (_event: React.MouseEvent, tabIndex: number): void => {
    this.setState({
      ruleTabKey: tabIndex
    });
  };

  render(): React.ReactNode {
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
            <Button variant={ButtonVariant.secondary} onClick={this.props.onAddRule} data-test="add-route">
              Add Route Rule
            </Button>
          </span>
        </div>
      </>
    );
  }
}
