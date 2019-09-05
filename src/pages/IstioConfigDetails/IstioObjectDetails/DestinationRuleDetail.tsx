import * as React from 'react';
import { DestinationRule, ObjectValidation } from '../../../types/IstioObjects';
import LocalTime from '../../../components/Time/LocalTime';
import DetailObject from '../../../components/Details/DetailObject';
import Label from '../../../components/Label/Label';
import { Link } from 'react-router-dom';
import { Card, CardBody, Grid, GridItem, Text, TextVariants } from '@patternfly/react-core';
import { Table, TableBody, TableHeader, TableVariant } from '@patternfly/react-table';
import Validation from '../../../components/Validations/Validation';
import { ServiceIcon } from '@patternfly/react-icons';

interface DestinationRuleProps {
  namespace: string;
  destinationRule: DestinationRule;
  validation?: ObjectValidation;
}

class DestinationRuleDetail extends React.Component<DestinationRuleProps> {
  globalStatus() {
    const validation = this.props.validation;
    if (validation && !validation.valid) {
      return <Validation validation={validation} />;
    } else {
      return undefined;
    }
  }

  columnsSubsets() {
    return [
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
    return subsets.map(subset => ({
      cells: [
        subset.name,
        {
          title: subset.labels
            ? Object.keys(subset.labels).map(key => <Label key={key} name={key} value={subset.labels[key]} />)
            : []
        },
        { title: <DetailObject name="" detail={subset.trafficPolicy} /> }
      ]
    }));
  }

  generateSubsets() {
    const subsets = this.props.destinationRule.spec.subsets || [];
    const hasSubsets = subsets.length > 0;

    return (
      <GridItem>
        <Card>
          <CardBody>
            <>
              <Text component={TextVariants.h2}>Subsets</Text>
              {hasSubsets ? (
                <Table variant={TableVariant.compact} cells={this.columnsSubsets()} rows={this.rowsSubset()}>
                  <TableHeader />
                  <TableBody />
                </Table>
              ) : (
                <Text component={TextVariants.p}>No subsets defined.</Text>
              )}
            </>
          </CardBody>
        </Card>
      </GridItem>
    );
  }

  serviceLink(namespace: string, host: string, isValid: boolean): any {
    if (!host) {
      return '-';
    }
    // TODO Full FQDN are not linked yet, it needs more checks in crossnamespace scenarios + validation of target
    if (host.indexOf('.') > -1 || !isValid) {
      return host;
    } else {
      return (
        <Link to={'/namespaces/' + namespace + '/services/' + host}>
          {host + ' '}
          <ServiceIcon />
        </Link>
      );
    }
  }

  rawConfig() {
    const destinationRule = this.props.destinationRule;
    const globalStatus = this.globalStatus();
    const isValid = globalStatus ? true : false;
    return (
      <GridItem span={6}>
        <Card>
          <CardBody>
            <Text component={TextVariants.h2}>Destination Rule Overview</Text>
            {globalStatus}
            <Text component={TextVariants.h3}>Created at</Text>
            <LocalTime time={destinationRule.metadata.creationTimestamp || ''} />

            <Text component={TextVariants.h3}>Resource Version</Text>
            {destinationRule.metadata.resourceVersion}
            {destinationRule.spec.host && (
              <>
                <Text component={TextVariants.h3}>Host</Text>
                {this.serviceLink(destinationRule.metadata.namespace || '', destinationRule.spec.host, isValid)}
              </>
            )}
          </CardBody>
        </Card>
      </GridItem>
    );
  }

  trafficPolicy() {
    const destinationRule = this.props.destinationRule;
    const hasTrafficPolicy = !!destinationRule.spec.trafficPolicy;

    return (
      <GridItem span={6}>
        <Card>
          <CardBody>
            <Text component={TextVariants.h2}>Traffic Policy</Text>
            {hasTrafficPolicy ? (
              <DetailObject name="" detail={destinationRule.spec.trafficPolicy} />
            ) : (
              <Text component={TextVariants.p}>No traffic policy defined.</Text>
            )}
          </CardBody>
        </Card>
      </GridItem>
    );
  }

  render() {
    return (
      <div className="container-fluid container-cards-pf">
        <Grid gutter={'md'}>
          {this.rawConfig()}
          {this.trafficPolicy()}
          {this.generateSubsets()}
        </Grid>
      </div>
    );
  }
}

export default DestinationRuleDetail;
