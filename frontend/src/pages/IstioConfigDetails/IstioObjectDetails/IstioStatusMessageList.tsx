import * as React from 'react';
import { IstioLevelToSeverity, ValidationMessage, ValidationTypes } from '../../../types/IstioObjects';
import { Flex, FlexItem, Stack, StackItem, Title, TitleSizes } from '@patternfly/react-core';
import Validation from '../../../components/Validations/Validation';

interface Props {
  messages: ValidationMessage[];
}

class IstioStatusMessageList extends React.Component<Props> {
  render() {
    return (
      <>
        <Stack>
          <StackItem>
            <Title headingLevel="h4" size={TitleSizes.lg} style={{ paddingBottom: '10px' }}>
              Configuration Analysis
            </Title>
          </StackItem>
          {this.props.messages.map((msg: ValidationMessage, i: number) => {
            const severity: ValidationTypes = IstioLevelToSeverity[msg.level || 'UNKNOWN'];
            return (
              <StackItem id={'msg-' + i} className={'validation-message'}>
                <Flex>
                  <FlexItem>
                    <Validation severity={severity} />
                  </FlexItem>
                  <FlexItem>
                    <a href={msg.documentationUrl} target="_blank" rel="noopener noreferrer">
                      {msg.type.code}
                    </a>
                    {msg.description ? ': ' + msg.description : undefined}
                  </FlexItem>
                </Flex>
              </StackItem>
            );
          })}
        </Stack>
      </>
    );
  }
}

export default IstioStatusMessageList;
