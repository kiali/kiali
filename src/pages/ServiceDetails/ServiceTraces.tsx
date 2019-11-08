import * as React from 'react';
import { JaegerIntegration } from '../../components/JaegerIntegration';
import { Card, CardBody, Grid, GridItem } from '@patternfly/react-core';

interface ServiceTracesProps {
  namespace: string;
  service: string;
  errorTags?: boolean;
}

class ServiceTraces extends React.Component<ServiceTracesProps> {
  render() {
    const serviceSelected = `${this.props.service}.${this.props.namespace}`;
    const tags = this.props.errorTags ? 'error=true' : '';
    return (
      <Grid style={{ padding: '20px' }}>
        <GridItem span={12}>
          <Card>
            <CardBody>
              <JaegerIntegration serviceSelected={serviceSelected} tagsValue={tags} disableSelectorNs={true} />
            </CardBody>
          </Card>
        </GridItem>
      </Grid>
    );
  }
}

export default ServiceTraces;
