import * as React from 'react';
import {IstioLevelToSeverity, ObjectCheck, ValidationMessage, ValidationTypes} from '../../../types/IstioObjects';
import { Flex, FlexItem, Stack, StackItem, Title, TitleSizes, Tooltip } from '@patternfly/react-core';
import Validation from '../../../components/Validations/Validation';

interface Props {
  messages: ValidationMessage[];
  checks?: ObjectCheck[];
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
          <Stack>
            {(this.props.checks || []).map((check, index) => {
              return (
                <StackItem id={'valid_msg-' + index} className={'validation-message'}>
                  <Tooltip content={check.message}>
                    <Flex>
                      <FlexItem>
                        <Validation severity={check.severity} />
                      </FlexItem>
                      <FlexItem>
                        {check.code}
                      </FlexItem>
                    </Flex>
                  </Tooltip>
                </StackItem>
              );
            })}
          </Stack>
        </Stack>
      </>
    );
  }
}

export default IstioStatusMessageList;
