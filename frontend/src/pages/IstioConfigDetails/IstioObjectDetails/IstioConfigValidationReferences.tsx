import { Stack, StackItem, Title, TitleLevel, TitleSize } from '@patternfly/react-core';
import { ReferenceIstioObjectLink } from 'components/Link/IstioObjectLink';
import * as React from 'react';
import { ObjectReference } from 'types/IstioObjects';

interface IstioConfigReferencesProps {
  objectReferences: ObjectReference[];
}

class IstioConfigValidationReferences extends React.Component<IstioConfigReferencesProps> {
  render() {
    return (
      <Stack>
        <StackItem>
          <Title headingLevel={TitleLevel.h5} size={TitleSize.lg} style={{ paddingBottom: '10px' }}>
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
                  type={reference.objectType}
                />
              </StackItem>
            );
          })}
      </Stack>
    );
  }
}

export default IstioConfigValidationReferences;
