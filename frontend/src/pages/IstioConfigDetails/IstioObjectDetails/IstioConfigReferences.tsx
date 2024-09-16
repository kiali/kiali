import { Stack, StackItem, Title, TitleSizes } from '@patternfly/react-core';
import { ReferenceIstioObjectLink } from 'components/Link/IstioObjectLink';
import { ServiceLink } from 'components/Link/ServiceLink';
import { WorkloadLink } from 'components/Link/WorkloadLink';
import * as React from 'react';
import { ObjectReference, ServiceReference, WorkloadReference } from 'types/IstioObjects';

interface IstioConfigReferencesProps {
  cluster?: string;
  isValid: boolean | undefined;
  objectReferences: ObjectReference[];
  serviceReferences: ServiceReference[];
  workloadReferences: WorkloadReference[];
}

export class IstioConfigReferences extends React.Component<IstioConfigReferencesProps> {
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

  render(): React.ReactNode {
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
          this.props.serviceReferences.map((reference, sRef) => {
            return (
              <StackItem key={`serviceReferenceExist_${sRef}`}>
                <ServiceLink name={reference.name} namespace={reference.namespace} cluster={this.props.cluster} />
              </StackItem>
            );
          })}
        {this.workloadReferencesExists() &&
          this.props.workloadReferences.map((reference, wRef) => {
            return (
              <StackItem key={`workloadReferenceExist_${wRef}`}>
                <WorkloadLink name={reference.name} namespace={reference.namespace} cluster={this.props.cluster} />
              </StackItem>
            );
          })}
        {this.objectReferencesExists() &&
          this.props.objectReferences.map((reference, iRef) => {
            return (
              <StackItem key={`objectReferenceExist_${iRef}`}>
                <ReferenceIstioObjectLink
                  name={reference.name}
                  namespace={reference.namespace}
                  cluster={this.props.cluster}
                  objectGVK={reference.objectGVK}
                />
              </StackItem>
            );
          })}
      </Stack>
    );
  }
}
