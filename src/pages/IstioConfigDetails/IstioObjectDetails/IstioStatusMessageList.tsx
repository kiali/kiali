import * as React from 'react';
import { IstioLevelToSeverity, ValidationMessage, ValidationTypes } from '../../../types/IstioObjects';
import { Split, SplitItem, Stack, StackItem, Title, TitleLevel, TitleSize } from '@patternfly/react-core';
import Validation from '../../../components/Validations/Validation';

interface Props {
  messages: ValidationMessage[];
}

class IstioStatusMessageList extends React.Component<Props> {
  render() {
    return (
      <>
        <Title headingLevel={TitleLevel.h3} size={TitleSize.xl}>
          Analyzer Messages
        </Title>
        <Stack gutter="lg">
          {this.props.messages.map((msg: ValidationMessage, i: number) => {
            const severity: ValidationTypes = IstioLevelToSeverity[msg.level || 0];
            return (
              <StackItem id={'msg-' + i} className={'validation-message'}>
                <Split>
                  <SplitItem>
                    <Validation severity={severity} />
                  </SplitItem>
                  <SplitItem>
                    <a href={msg.documentation_url} target="_blank" rel="noopener noreferrer">
                      {msg.type.code}
                    </a>
                    {msg.description ? ': ' + msg.description : undefined}
                  </SplitItem>
                </Split>
              </StackItem>
            );
          })}
        </Stack>
      </>
    );
  }
}

export default IstioStatusMessageList;
