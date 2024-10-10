import { Stack, StackItem, Title, TitleSizes } from '@patternfly/react-core';
import { ReferenceIstioObjectLink } from 'components/Link/IstioObjectLink';
import * as React from 'react';
import { ObjectReference } from 'types/IstioObjects';

interface IstioConfigReferencesProps {
  cluster?: string;
  objectReferences: ObjectReference[];
}

export class IstioConfigValidationReferences extends React.Component<IstioConfigReferencesProps> {
  render(): React.ReactNode {
    return (
      <Stack>
        <StackItem>
          <Title headingLevel="h5" size={TitleSizes.lg} style={{ paddingBottom: '10px' }}>
            Validation References
          </Title>
        </StackItem>

        {this.props.objectReferences &&
          this.props.objectReferences.map(reference => {
            return (
              <StackItem>
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
