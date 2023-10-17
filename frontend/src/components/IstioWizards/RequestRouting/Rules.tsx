import * as React from 'react';
import {
  IRow,
  IAction,
  Table,
  Thead,
  Tbody,
  Tr,
  Td,
  Th,
  IRowCell,
  ActionsColumn,
  ThProps
} from '@patternfly/react-table';
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
  abort?: Abort;
  delay?: Delay;
  matches: string[];
  retries?: HTTPRetry;
  timeout?: string;
  workloadWeights: WorkloadWeight[];
};

type RulesProps = {
  onRemoveRule: (index: number) => void;
  onMoveRule: (index: number, move: MOVE_TYPE) => void;
  rules: Rule[];
};

const validationStyle = kialiStyle({
  marginTop: '0.75rem',
  color: PFColors.Red100
});

const noRulesStyle = kialiStyle({
  marginTop: '0.75rem',
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export const Rules: React.FC<RulesProps> = (props: RulesProps) => {
  const matchAllIndex = (rules: Rule[]): number => {
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

  const actionResolver = (rowIndex): IAction[] => {
    const removeAction = {
      title: 'Remove Rule',
      onClick: () => props.onRemoveRule(rowIndex)
    };

    const moveUpAction = {
      title: 'Move Up',
      onClick: () => props.onMoveRule(rowIndex, MOVE_TYPE.UP)
    };

    const moveDownAction = {
      title: 'Move Down',
      onClick: () => props.onMoveRule(rowIndex, MOVE_TYPE.DOWN)
    };

    const actions: any[] = [];

    if (props.rules.length > 0) {
      actions.push(removeAction);
    }

    if (rowIndex > 0) {
      actions.push(moveUpAction);
    }

    if (rowIndex + 1 < props.rules.length) {
      actions.push(moveDownAction);
    }

    return actions;
  };

  const columns: ThProps[] = [
    {
      title: 'Rule order',
      width: 10
    },
    {
      title: 'Request Matching'
    },
    {
      title: 'Route To'
    }
  ];

  let isValid: boolean = true;

  const matchAll: number = matchAllIndex(props.rules);

  const routeRules: IRow[] =
    props.rules.length > 0
      ? props.rules.map((rule, order) => {
          isValid = matchAll === -1 || order <= matchAll;

          return {
            cells: [
              { title: <>{order + 1}</> },
              {
                title: (
                  <>
                    {rule.matches.length === 0
                      ? 'Any request'
                      : rule.matches.map((match, i) => <div key={'match_' + i}>{match}</div>)}
                    {!isValid && (
                      <div className={validationStyle}>
                        Match 'Any request' is defined in a previous rule.
                        <br />
                        This rule is not accessible.
                      </div>
                    )}
                  </>
                )
              },
              {
                title: (
                  <>
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
                  </>
                )
              }
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
                    <EmptyStateHeader titleText="No Route Rules defined" headingLevel="h5" />
                    <EmptyStateBody className={noRulesStyle}>
                      A Request Routing scenario needs at least a Route Rule
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
      Route Rules
      {wizardTooltip(ROUTE_RULES_TOOLTIP)}
      <Table aria-label="K8sRules Created">
        <Thead>
          <Tr>
            {columns.map((column, index) => (
              <Th key={`column_${index}`} width={column.width}>
                {column.title}
              </Th>
            ))}
          </Tr>
        </Thead>

        <Tbody>
          {routeRules.map((row, index) => (
            <Tr key={`row_${index}`} className={row.className}>
              {(row.cells as IRowCell[])?.map((cell, index) => (
                <Td dataLabel={columns[index].title} colSpan={cell.props?.colSpan}>
                  {cell.title}
                </Td>
              ))}
              {row.key !== 'rowEmpty' && (
                <Td isActionCell>
                  <ActionsColumn items={actionResolver(index)} />
                </Td>
              )}
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  );
};
