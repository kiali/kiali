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
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ROUTE_RULES_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { K8sRouteBackendRef } from '../K8sTrafficShifting';

export enum MOVE_TYPE {
  UP,
  DOWN
}

export type K8sRule = {
  backendRefs: K8sRouteBackendRef[];
  filters: string[];
  matches: string[];
};

type K8sRuleProps = {
  k8sRules: K8sRule[];
  onMoveRule: (index: number, move: MOVE_TYPE) => void;
  onRemoveRule: (index: number) => void;
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

export const K8sRules: React.FC<K8sRuleProps> = (props: K8sRuleProps) => {
  const matchAllIndex = (k8sRules: K8sRule[]): number => {
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

  const actionResolver = (rowIndex: number): IAction[] => {
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

    const actions: IAction[] = [];

    if (props.k8sRules.length > 0) {
      actions.push(removeAction);
    }

    if (rowIndex > 0) {
      actions.push(moveUpAction);
    }

    if (rowIndex + 1 < props.k8sRules.length) {
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
      title: 'Route Filtering'
    },
    {
      title: 'Route To'
    }
  ];

  let isValid: boolean = true;

  const matchAll: number = matchAllIndex(props.k8sRules);

  const routeRules: IRow[] =
    props.k8sRules.length > 0
      ? props.k8sRules.map((rule, order) => {
          isValid = matchAll === -1 || order <= matchAll;

          return {
            cells: [
              { title: <>{order + 1}</> },
              {
                title: (
                  <>
                    {!rule.matches || rule.matches.length === 0
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
                    {!rule.filters || rule.filters.length === 0
                      ? 'No Request Filter'
                      : rule.filters.map((filter, i) => <div key={'filter_' + i}>{filter}</div>)}
                  </>
                )
              },
              {
                title: (
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
                    <EmptyStateHeader titleText="No K8s Route Rules defined" headingLevel="h5" />
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
      Route K8sRules
      {wizardTooltip(ROUTE_RULES_TOOLTIP)}
      <Table aria-label="K8sRules Created">
        <Thead>
          <Tr>
            {columns.map((column, index) => (
              <Th key={`column_${index}`} dataLabel={column.title} width={column.width}>
                {column.title}
              </Th>
            ))}
          </Tr>
        </Thead>

        <Tbody>
          {routeRules.map((row, index) => (
            <Tr key={`row_${index}`} className={row.className}>
              {(row.cells as IRowCell[])?.map((cell, index) => (
                <Td key={`cell_${index}`} dataLabel={columns[index].title} colSpan={cell.props?.colSpan}>
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
