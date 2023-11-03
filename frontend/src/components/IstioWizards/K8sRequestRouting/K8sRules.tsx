import * as React from 'react';
import { IRow, IAction, ThProps, IRowData } from '@patternfly/react-table';
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
import { SimpleTable } from 'components/SimpleTable';

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

  const actionResolver = (_rowData: IRowData, rowIndex: number): IAction[] => {
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

  const noK8sRules: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.full}>
      <EmptyStateHeader titleText="No K8s Route Rules defined" headingLevel="h5" />
      <EmptyStateBody className={noRulesStyle}>A Request Routing scenario needs at least a Route Rule</EmptyStateBody>
    </EmptyState>
  );

  const routeRules: IRow[] = props.k8sRules.map((rule, order) => {
    isValid = matchAll === -1 || order <= matchAll;

    return {
      cells: [
        <>{order + 1}</>,
        <>
          {!rule.matches || rule.matches.length === 0
            ? 'Any request'
            : rule.matches.map((match, i) => <div key={`match_${i}`}>{match}</div>)}
          {!isValid && (
            <div className={validationStyle}>
              Match 'Any request' is defined in a previous rule.
              <br />
              This rule is not accessible.
            </div>
          )}
        </>,
        <>
          {!rule.filters || rule.filters.length === 0
            ? 'No Request Filter'
            : rule.filters.map((filter, i) => <div key={`filter_${i}`}>{filter}</div>)}
        </>,
        <div key={`br_${order}`}>
          {rule.backendRefs &&
            rule.backendRefs.map((bRef, i) => {
              return (
                <div key={`br_${order}_${bRef.name}_${i}`}>
                  <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                  {bRef.name} ({bRef.weight}% routed traffic)
                </div>
              );
            })}
        </div>
      ]
    };
  });

  return (
    <>
      <div>
        <span>Route K8sRules</span>
        {wizardTooltip(ROUTE_RULES_TOOLTIP)}
      </div>

      <SimpleTable
        label="K8sRules Created"
        columns={columns}
        rows={routeRules}
        actionResolver={actionResolver}
        emptyState={noK8sRules}
        verticalAlign="middle"
      />
    </>
  );
};
