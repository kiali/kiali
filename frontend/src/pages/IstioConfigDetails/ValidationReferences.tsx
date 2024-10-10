import * as React from 'react';
import { Stack, StackItem, Title, TitleSizes } from '@patternfly/react-core';
import { ReferenceIstioObjectLink } from '../../components/Link/IstioObjectLink';
import { ObjectReference } from '../../types/IstioObjects';

interface Props {
  cluster?: string;
  objectReferences: ObjectReference[];
}

export class ValidationReferences extends React.Component<Props> {
  render(): React.ReactNode {
    return (
      <>
        <Title headingLevel="h3" size={TitleSizes.xl}>
          Validation references
        </Title>
        <Stack>
          {this.props.objectReferences.map((reference, i) => {
            return (
              <StackItem key={`el-object-${i}`}>
                <ReferenceIstioObjectLink
                  cluster={this.props.cluster}
                  name={reference.name}
                  objectGVK={reference.objectGVK}
                  namespace={reference.namespace}
                />
              </StackItem>
            );
          })}
        </Stack>
      </>
    );
  }
}
