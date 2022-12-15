import * as React from 'react';
import { cellWidth, ICell, Table, TableHeader, TableBody } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../Pf/PfColors';
import {
  EmptyState,
  EmptyStateBody,
  EmptyStateVariant,
  Title,
  TitleSizes,
  TooltipPosition
} from '@patternfly/react-core';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { ROUTE_RULES_TOOLTIP, wizardTooltip } from '../WizardHelp';
import {K8sRouteBackendRef} from '../K8sTrafficShifting';

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

const validationStyle = style({
  marginTop: 15,
  color: PFColors.Red100
});

const noRulesStyle = style({
  marginTop: 15,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

class K8sRules extends React.Component<Props> {
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
    // TODO: Casting 'as any' because @patternfly/react-table@2.22.19 has a typing bug. Remove the casting when PF fixes it.
    // https://github.com/patternfly/patternfly-next/issues/2373
    const headerCells: ICell[] = [
      {
        title: 'Rule order',
        transforms: [cellWidth(10) as any],
        props: {}
      },
      {
        title: 'Request Matching',
        props: {}
      },
      {
        title: 'Route Filtering',
        props: {}
      },
      {
        title: 'Route To',
        props: {}
      }
    ];

    let isValid: boolean = true;
    const matchAll: number = this.matchAllIndex(this.props.k8sRules);
    const routeRules =
      this.props.k8sRules.length > 0
        ? this.props.k8sRules.map((rule, order) => {
            isValid = matchAll === -1 || order <= matchAll;
            return {
              cells: [
                <>{order + 1}</>,
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
                </>,
                <>
                  {!rule.filters || rule.filters.length === 0
                    ? 'No Request Filter'
                    : rule.filters.map((filter, i) => <div key={'filter_' + i}>{filter}</div>)}
                </>,
                <>
                  <div key={'br_' + order}>
                    {rule.backendRefs && rule.backendRefs
                      .map((bRef, i) => {
                        return (
                          <div key={'br_' + order + '_' + bRef.name + '_' + i}>
                            <PFBadge badge={PFBadges.Workload} position={TooltipPosition.top} />
                            {bRef.name} ({bRef.weight}% routed traffic)
                          </div>
                        );
                      })}
                  </div>
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
                      <Title headingLevel="h5" size={TitleSizes.lg}>
                        No K8s Route Rules defined
                      </Title>
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
        <Table
          aria-label="K8sRules Created"
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

export default K8sRules;
