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
import { WorkloadWeight } from '../TrafficShifting';
import { Abort, Delay, HTTPRetry } from '../../../types/IstioObjects';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ROUTE_RULES_TOOLTIP, wizardTooltip } from '../WizardHelp';
import { SimpleTable } from 'components/Table/SimpleTable';

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
  onMoveRule: (index: number, move: MOVE_TYPE) => void;
  onRemoveRule: (index: number) => void;
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
    let matchAll = -1;

    for (let index = 0; index < rules.length; index++) {
      const rule = rules[index];

      if (rule.matches.length === 0) {
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

  let isValid = true;

  const matchAll: number = matchAllIndex(props.rules);

  const noRules: React.ReactNode = (
    <EmptyState variant={EmptyStateVariant.full}>
      <EmptyStateHeader titleText="No Route Rules defined" headingLevel="h5" />
      <EmptyStateBody className={noRulesStyle}>A Request Routing scenario needs at least a Route Rule</EmptyStateBody>
    </EmptyState>
  );

  const routeRules: IRow[] = props.rules.map((rule, order) => {
    isValid = matchAll === -1 || order <= matchAll;

    return {
      cells: [
        <>{order + 1}</>,
        <>
          {rule.matches.length === 0
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
          <div key={`ww_${order}`}>
            {rule.workloadWeights
              .filter(wk => !wk.mirrored)
              .map((wk, i) => {
                return (
                  <div key={`wk_${order}_${wk.name}_${i}`}>
                    <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                    {wk.name} ({wk.weight}% routed traffic)
                  </div>
                );
              })}

            {rule.workloadWeights
              .filter(wk => wk.mirrored)
              .map((wk, i) => {
                return (
                  <div key={`wk_mirrored_${order}_${wk.name}_${i}`}>
                    <PFBadge badge={PFBadges.MirroredWorkload} position={TooltipPosition.top} />
                    {wk.name} ({wk.weight}% mirrored traffic)
                  </div>
                );
              })}
          </div>

          {rule.delay && (
            <div key={`delay_${order}`}>
              <PFBadge badge={PFBadges.FaultInjectionDelay} position={TooltipPosition.top} />
              {rule.delay.percentage?.value}% requests delayed ({rule.delay.fixedDelay})
            </div>
          )}

          {rule.abort && (
            <div key={`abort_${order}`}>
              <PFBadge badge={PFBadges.FaultInjectionAbort} position={TooltipPosition.top} />
              {rule.abort.percentage?.value}% requests aborted (HTTP Status {rule.abort.httpStatus})
            </div>
          )}

          {rule.timeout && (
            <div key={`timeout_${order}`}>
              <PFBadge badge={PFBadges.RequestTimeout} position={TooltipPosition.top} />
              timeout ({rule.timeout})
            </div>
          )}

          {rule.retries && (
            <div key={`retries_${order}`}>
              <PFBadge badge={PFBadges.RequestRetry} position={TooltipPosition.top} />
              {rule.retries.attempts} attempts with timeout ({rule.timeout})
            </div>
          )}
        </>
      ]
    };
  });

  return (
    <>
      <div>
        <span>Route Rules</span>
        {wizardTooltip(ROUTE_RULES_TOOLTIP)}
      </div>

      <SimpleTable
        label="Rules Created"
        columns={columns}
        rows={routeRules}
        actionResolver={actionResolver}
        emptyState={noRules}
        verticalAlign="middle"
      />
    </>
  );
};
