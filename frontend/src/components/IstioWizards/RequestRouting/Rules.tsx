import * as React from 'react';
import { cellWidth, ICell } from '@patternfly/react-table';
import { Table, TableHeader, TableBody } from '@patternfly/react-table/deprecated';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../Pf/PfColors';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  TooltipPosition,
  EmptyStateHeader
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
      title: $t('RemoveRule', 'Remove Rule'),
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => this.props.onRemoveRule(rowIndex)
    };
    const moveUpAction = {
      title: $t('MoveUp', 'Move Up'),
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => this.props.onMoveRule(rowIndex, MOVE_TYPE.UP)
    };
    const moveDownAction = {
      title: $t('MoveDown', 'Move Down'),
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
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    const headerCells: ICell[] = [
      {
        title: $t('RuleOrder', 'Rule order'),
        transforms: [cellWidth(10) as any],
        props: {}
      },
      {
        title: $t('RequestMatching', 'Request Matching'),
        props: {}
      },
      {
        title: $t('RouteTo', 'Route To'),
        props: {}
      }
    ];

    let isValid: boolean = true;
    const matchAll: number = this.matchAllIndex(this.props.rules);
    const routeRules =
      this.props.rules.length > 0
        ? this.props.rules.map((rule, order) => {
            isValid = matchAll === -1 || order <= matchAll;
            return {
              cells: [
                <>{order + 1}</>,
                <>
                  {rule.matches.length === 0
                    ? $t('AnyRequest', 'Any request')
                    : rule.matches.map((match, i) => <div key={'match_' + i}>{match}</div>)}
                  {!isValid && (
                    <div className={validationStyle}>
                      {$t('tip6', "Match 'Any request' is defined in a previous rule.")}
                      <br />
                      {$t('tip7', 'This rule is not accessible.')}
                    </div>
                  )}
                </>,
                <>
                  <div key={'ww_' + order}>
                    {rule.workloadWeights
                      .filter(wk => !wk.mirrored)
                      .map((wk, i) => {
                        return (
                          <div key={'wk_' + order + '_' + wk.name + '_' + i}>
                            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                            {wk.name} ({wk.weight}% {$t('routedTraffic', 'routed traffic')})
                          </div>
                        );
                      })}
                    {rule.workloadWeights
                      .filter(wk => wk.mirrored)
                      .map((wk, i) => {
                        return (
                          <div key={'wk_mirrored_' + order + '_' + wk.name + '_' + i}>
                            <PFBadge badge={PFBadges.MirroredWorkload} position={TooltipPosition.top} />
                            {wk.name} ({wk.weight}% {$t('mirroredTraffic', 'mirrored traffic')})
                          </div>
                        );
                      })}
                  </div>
                  {rule.delay && (
                    <div key={'delay_' + order}>
                      <PFBadge badge={PFBadges.FaultInjectionDelay} position={TooltipPosition.top} />
                      {rule.delay.percentage?.value}% {$t('requestsDelayed', 'requests delayed')} (
                      {rule.delay.fixedDelay})
                    </div>
                  )}
                  {rule.abort && (
                    <div key={'abort_' + order}>
                      <PFBadge badge={PFBadges.FaultInjectionAbort} position={TooltipPosition.top} />
                      {rule.abort.percentage?.value}% {$t('tip294', 'requests aborted (HTTP Status')}{' '}
                      {rule.abort.httpStatus})
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
                      {rule.retries.attempts} {$t('attemptsWithTimeout', 'attempts with timeout')} ({rule.timeout})
                    </div>
                  )}
                </>
              ]
            };
          })
        : [
            {
              key: 'rowEmpty',
              cells: [
                {
                  title: (
                    <EmptyState variant={EmptyStateVariant.full}>
                      <EmptyStateHeader titleText={$t('title1', 'No Route Rules defined')} headingLevel="h5" />
                      <EmptyStateBody className={noRulesStyle}>
                        {$t('tip9', 'A Request Routing scenario needs at least a Route Rule')}
                      </EmptyStateBody>
                    </EmptyState>
                  ),
                  props: { colSpan: 3 }
                }
              ]
            }
          ];

    return (
      <>
        {$t('RouteRules', 'Route Rules')}
        {wizardTooltip(ROUTE_RULES_TOOLTIP)}
        <Table
          aria-label="Rules Created"
          cells={headerCells}
          rows={routeRules}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
      </>
    );
  }
}
