import { Stack, StackItem, Title, TitleSizes } from '@patternfly/react-core';
import { ReferenceIstioObjectLink } from 'components/Link/IstioObjectLink';
import ServiceLink from 'components/Link/ServiceLink';
import WorkloadLink from 'components/Link/WorkloadLink';
import * as React from 'react';
import { ObjectReference, ServiceReference, WorkloadReference } from 'types/IstioObjects';

interface IstioConfigReferencesProps {
  objectReferences: ObjectReference[];
  serviceReferences: ServiceReference[];
  workloadReferences: WorkloadReference[];
  isValid: boolean | undefined;
}

class IstioConfigReferences extends React.Component<IstioConfigReferencesProps> {
  objectReferencesExists = (): boolean => {
    if (this.props.objectReferences && this.props.objectReferences.length > 0) {
      return true;
    }
    return false;
  };

  serviceReferencesExists = (): boolean => {
    if (this.props.serviceReferences && this.props.serviceReferences.length > 0) {
      return true;
    }
    return false;
  };

  workloadReferencesExists = (): boolean => {
    if (this.props.workloadReferences && this.props.workloadReferences.length > 0) {
      return true;
    }
    return false;
  };

  render() {
    return (
      <Stack>
        <StackItem>
          <Title headingLevel="h5" size={TitleSizes.lg} style={{ paddingBottom: '10px' }}>
            References
          </Title>
        </StackItem>
        {!this.objectReferencesExists() && !this.serviceReferencesExists() && !this.workloadReferencesExists() && (
          <StackItem>No references found for this object.</StackItem>
        )}
        {this.serviceReferencesExists() &&
          this.props.serviceReferences.map(reference => {
            return (
              <StackItem>
                <ServiceLink name={reference.name} namespace={reference.namespace} />
              </StackItem>
            );
          })}
        {this.workloadReferencesExists() &&
          this.props.workloadReferences.map(reference => {
            return (
              <StackItem>
                <WorkloadLink name={reference.name} namespace={reference.namespace} />
              </StackItem>
            );
          })}
        {this.objectReferencesExists() &&
          this.props.objectReferences.map(reference => {
            return (
              <StackItem>
                <ReferenceIstioObjectLink
                  name={reference.name}
                  namespace={reference.namespace}
                  type={reference.objectType}
                />
              </StackItem>
            );
          })}
      </Stack>
    );
  }
}

export default IstioConfigReferences;
