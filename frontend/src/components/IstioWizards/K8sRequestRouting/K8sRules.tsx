import * as React from 'react';
import { Table, Tbody, Thead, Tr, Th, Td } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../Pf/PfColors';
import {
  Bullseye,
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  TitleSizes,
  TooltipPosition
} from '@patternfly/react-core';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ROUTE_RULES_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { K8sRouteBackendRef } from '../K8sTrafficShifting';

export enum MOVE_TYPE {
  UP,
  DOWN
}

export type K8sRule = {
  matches: string[];
  filters: string[];
  backendRefs: K8sRouteBackendRef[];
};

type Props = {
  k8sRules: K8sRule[];
  onRemoveRule: (index: number) => void;
  onMoveRule: (index: number, move: MOVE_TYPE) => void;
};

const validationStyle = kialiStyle({
  marginTop: 15,
  color: PFColors.Red100
});

const noRulesStyle = kialiStyle({
  marginTop: 15,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export class K8sRules extends React.Component<Props> {
  matchAllIndex = (k8sRules: K8sRule[]): number => {
    let matchAll: number = -1;
    for (let index = 0; index < k8sRules.length; index++) {
      const rule = k8sRules[index];
      if (!rule.matches || rule.matches.length === 0) {
        matchAll = index;
        break;
      }
    }
    return matchAll;
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Rule',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => this.props.onRemoveRule(rowIndex)
    };
    const moveUpAction = {
      title: 'Move Up',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => this.props.onMoveRule(rowIndex, MOVE_TYPE.UP)
    };
    const moveDownAction = {
      title: 'Move Down',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => this.props.onMoveRule(rowIndex, MOVE_TYPE.DOWN)
    };

    const actions: any[] = [];
    if (this.props.k8sRules.length > 0) {
      actions.push(removeAction);
    }
    if (rowIndex > 0) {
      actions.push(moveUpAction);
    }
    if (rowIndex + 1 < this.props.k8sRules.length) {
      actions.push(moveDownAction);
    }
    return actions;
  };

  render() {
    const matchAll: number = this.matchAllIndex(this.props.k8sRules);
    return (
      <>
        Route K8sRules
        {wizardTooltip(ROUTE_RULES_TOOLTIP)}
        <Table
          aria-label="K8sRules Created"
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <Thead>
            <Tr>
              <Th width={10}>Rule order</Th>
              <Th>Request Matching</Th>
              <Th>Route Filtering</Th>
              <Th>Route To</Th>
            </Tr>
          </Thead>
          <Tbody>
            {this.props.k8sRules.map((rule, order) => (
              <Tr key={`k8srule_${order}`}>
                <Td>{order + 1}</Td>
                <Td>
                  {!rule.matches || rule.matches.length === 0
                    ? 'Any request'
                    : rule.matches.map((match, i) => <div key={'match_' + i}>{match}</div>)}
                  {!(matchAll === -1 || order <= matchAll) && (
                    <div className={validationStyle}>
                      Match 'Any request' is defined in a previous rule.
                      <br />
                      This rule is not accessible.
                    </div>
                  )}
                </Td>
                <Td>
                  {!rule.filters || rule.filters.length === 0
                    ? 'No Request Filter'
                    : rule.filters.map((filter, i) => <div key={'filter_' + i}>{filter}</div>)}
                </Td>
                <Td>
                  <div key={'br_' + order}>
                    {rule.backendRefs &&
                      rule.backendRefs.map((bRef, i) => {
                        return (
                          <div key={'br_' + order + '_' + bRef.name + '_' + i}>
                            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                            {bRef.name} ({bRef.weight}% routed traffic)
                          </div>
                        );
                      })}
                  </div>
                </Td>
              </Tr>
            ))}
            {this.props.k8sRules.length === 0 && (
              <Tr key={'nok8srules'}>
                <Td colSpan={3}>
                  <Bullseye>
                    <EmptyState variant={EmptyStateVariant.full}>
                      <Title headingLevel="h5" size={TitleSizes.lg}>
                        No K8s Route Rules defined
                      </Title>
                      <EmptyStateBody className={noRulesStyle}>
                        A Request Routing scenario needs at least a Route Rule
                      </EmptyStateBody>
                    </EmptyState>
                  </Bullseye>
                </Td>
              </Tr>
            )}
          </Tbody>
        </Table>
      </>
    );
  }
}
