import * as React from 'react';
import { Stack, StackItem, Title, TitleSizes} from '@patternfly/react-core';
import { ReferenceIstioObjectLink } from '../../components/Link/IstioObjectLink';
import { ObjectReference } from '../../types/IstioObjects';

interface Props {
  objectReferences: ObjectReference[];
}

class ValidationReferences extends React.Component<Props> {
  render() {
    return (
      <>
        <Title headingLevel="h3" size={TitleSizes.xl}>
          Validation references
        </Title>
        <Stack>
          {this.props.objectReferences.map((reference, i) => {
            return (
              <StackItem key={'rel-object-' + i}>
                <ReferenceIstioObjectLink
                  name={reference.name}
                  type={reference.objectType}
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

export default ValidationReferences;
