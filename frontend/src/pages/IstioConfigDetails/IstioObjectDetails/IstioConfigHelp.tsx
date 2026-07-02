import { Stack, StackItem, Title, TitleSizes } from '@patternfly/react-core';
import * as React from 'react';
import type { HelpMessage } from 'types/IstioObjects';

interface IstioConfigHelpProps {
  helpMessages?: HelpMessage[];
  selectedLine?: string;
}

export class IstioConfigHelp extends React.Component<IstioConfigHelpProps> {
  render(): React.ReactNode {
    const helpMessage = this.props.helpMessages?.find(helpMessage =>
      this.props.selectedLine?.includes(helpMessage.objectField.substring(helpMessage.objectField.lastIndexOf('.') + 1))
    );

    return (
      <Stack>
        <StackItem>
          <Title headingLevel="h4" size={TitleSizes.lg} style={{ paddingBottom: '10px' }}>
            Help
          </Title>
        </StackItem>

        {helpMessage && (
          <>
            <StackItem>
              <Title headingLevel="h5" size={TitleSizes.md}>
                {helpMessage.objectField}
              </Title>
            </StackItem>
            <StackItem style={{ marginTop: '10px' }}>
              <p>{helpMessage.message}</p>
            </StackItem>
          </>
        )}
        {!helpMessage && (
          <StackItem>
            <p>Select a highlighted field in the editor to see contextual help.</p>
          </StackItem>
        )}
      </Stack>
    );
  }
}
