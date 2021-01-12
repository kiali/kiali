import * as React from 'react';
import { DestinationRule, ObjectValidation } from '../../../types/IstioObjects';
import DetailObject from '../../../components/Details/DetailObject';
import {
  Stack,
  StackItem,
  Text,
  TextVariants,
  Title,
  TitleLevel,
  TitleSize,
  TooltipPosition
} from '@patternfly/react-core';
import { Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import GlobalValidation from '../../../components/Validations/GlobalValidation';
import { checkForPath } from '../../../types/ServiceInfo';
import ValidationList from '../../../components/Validations/ValidationList';
import Labels from '../../../components/Label/Labels';
import ServiceLink from './ServiceLink';
import './IstioObjectDetails.css';

interface DestinationRuleProps {
  namespace: string;
  destinationRule: DestinationRule;
  validation?: ObjectValidation;
}

class DestinationRuleOverview extends React.Component<DestinationRuleProps> {
  globalStatus() {
    const validation = this.props.validation;
    if (validation && !validation.valid) {
      return <GlobalValidation validation={validation} />;
    } else {
      return undefined;
    }
  }

  subsetValidation(subsetIndex: number) {
    const checks = checkForPath(this.props.validation, 'spec/subsets[' + subsetIndex + ']');
    return <ValidationList checks={checks} tooltipPosition={TooltipPosition.right} />;
  }

  columnsSubsets() {
    return [
      {
        title: 'Status',
        props: {}
      },
      {
        title: 'Name',
        props: {}
      },
      {
        title: 'Labels',
        props: {}
      },
      {
        title: 'Traffic Policy',
        props: {}
      }
    ];
  }

  rowsSubset() {
    const subsets = this.props.destinationRule.spec.subsets || [];
    return subsets.map((subset, index) => ({
      cells: [
        { title: this.subsetValidation(index) },
        { title: subset.name },
        { title: <Labels key={'subset-labels-' + index} labels={subset.labels} /> },
        { title: <DetailObject name="" detail={subset.trafficPolicy} /> }
      ]
    }));
  }

  generateSubsets() {
    const subsets = this.props.destinationRule.spec.subsets || [];
    const hasSubsets = subsets.length > 0;
    return (
      <>
        {hasSubsets ? (
          <Table
            aria-label={'DestinationRule SubSets table'}
            variant={TableVariant.compact}
            cells={this.columnsSubsets()}
            rows={this.rowsSubset()}
            className="table"
          >
            <TableHeader />
            <TableBody />
          </Table>
        ) : (
          <Text component={TextVariants.p}>No subsets defined.</Text>
        )}
      </>
    );
  }

  render() {
    const destinationRule = this.props.destinationRule;
    const globalStatus = this.globalStatus();
    const isValid = !globalStatus;
    return (
      <>
        <Title headingLevel={TitleLevel.h3} size={TitleSize.xl}>
          Destination Rule Overview
        </Title>
        <Stack>
          <StackItem id={'subsets'}>
            {destinationRule.spec.host && (
              <>
                <Text component={TextVariants.h3}>Host</Text>
                <ServiceLink
                  namespace={destinationRule.metadata.namespace || ''}
                  host={destinationRule.spec.host}
                  isValid={isValid}
                />
              </>
            )}
            {this.generateSubsets()}
          </StackItem>
        </Stack>
      </>
    );
  }
}

export default DestinationRuleOverview;
