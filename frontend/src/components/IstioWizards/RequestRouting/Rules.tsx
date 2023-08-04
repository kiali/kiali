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
import { WorkloadWeight } from '../TrafficShifting';
import { Abort, Delay, HTTPRetry } from '../../../types/IstioObjects';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ROUTE_RULES_TOOLTIP, wizardTooltip } from '../WizardHelp';

export enum MOVE_TYPE {
  UP,
  DOWN
}

export type Rule = {
  matches: string[];
  workloadWeights: WorkloadWeight[];
  delay?: Delay;
  abort?: Abort;
  timeout?: string;
  retries?: HTTPRetry;
};

type Props = {
  rules: Rule[];
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

export class Rules extends React.Component<Props> {
  matchAllIndex = (rules: Rule[]): number => {
    let matchAll: number = -1;
    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];
      if (rule.matches.length === 0) {
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
    if (this.props.rules.length > 0) {
      actions.push(removeAction);
    }
    if (rowIndex > 0) {
      actions.push(moveUpAction);
    }
    if (rowIndex + 1 < this.props.rules.length) {
      actions.push(moveDownAction);
    }
    return actions;
  };

  render() {
    const matchAll: number = this.matchAllIndex(this.props.rules);

    return (
      <>
        Route Rules
        {wizardTooltip(ROUTE_RULES_TOOLTIP)}
        <Table
          aria-label="Rules Created"
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <Thead>
            <Th width={10}>Rule order</Th>
            <Th>Request Matching</Th>
            <Th>Route To</Th>
          </Thead>
          <Tbody>
            {this.props.rules.map((rule, order) => (
              <Tr key={`Rule_${order}`}>
                <Td>{order + 1}</Td>
                <Td>
                  {rule.matches.length === 0
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
                  <div key={'ww_' + order}>
                    {rule.workloadWeights
                      .filter(wk => !wk.mirrored)
                      .map((wk, i) => {
                        return (
                          <div key={'wk_' + order + '_' + wk.name + '_' + i}>
                            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                            {wk.name} ({wk.weight}% routed traffic)
                          </div>
                        );
                      })}
                    {rule.workloadWeights
                      .filter(wk => wk.mirrored)
                      .map((wk, i) => {
                        return (
                          <div key={'wk_mirrored_' + order + '_' + wk.name + '_' + i}>
                            <PFBadge badge={PFBadges.MirroredWorkload} position={TooltipPosition.top} />
                            {wk.name} ({wk.weight}% mirrored traffic)
                          </div>
                        );
                      })}
                  </div>
                  {rule.delay && (
                    <div key={'delay_' + order}>
                      <PFBadge badge={PFBadges.FaultInjectionDelay} position={TooltipPosition.top} />
                      {rule.delay.percentage?.value}% requests delayed ({rule.delay.fixedDelay})
                    </div>
                  )}
                  {rule.abort && (
                    <div key={'abort_' + order}>
                      <PFBadge badge={PFBadges.FaultInjectionAbort} position={TooltipPosition.top} />
                      {rule.abort.percentage?.value}% requests aborted (HTTP Status {rule.abort.httpStatus})
                    </div>
                  )}
                  {rule.timeout && (
                    <div key={'timeout_' + order}>
                      <PFBadge badge={PFBadges.RequestTimeout} position={TooltipPosition.top} />
                      timeout ({rule.timeout})
                    </div>
                  )}
                  {rule.retries && (
                    <div key={'retries_' + order}>
                      <PFBadge badge={PFBadges.RequestRetry} position={TooltipPosition.top} />
                      {rule.retries.attempts} attempts with timeout ({rule.timeout})
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
            {this.props.rules.length === 0 && (
              <Tr key={'rowsEmpty'}>
                <Td colSpan={3}>
                  <Bullseye>
                    <EmptyState variant={EmptyStateVariant.full}>
                      <Title headingLevel="h5" size={TitleSizes.lg}>
                        No Route Rules defined
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
