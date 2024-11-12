import * as React from 'react';
import { IstioLevelToSeverity, ObjectCheck, ValidationMessage, ValidationTypes } from '../../../types/IstioObjects';
import { Flex, FlexItem, Stack, StackItem, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { Validation } from '../../../components/Validations/Validation';
import { KialiIcon } from '../../../config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';

interface Props {
  messages?: ValidationMessage[];
  checks?: ObjectCheck[];
}

const statusInfoStyle = kialiStyle({
  verticalAlign: '-0.125em !important'
});

export class IstioStatusMessageList extends React.Component<Props> {
  render() {
    return (
      <>
        <Stack>
          <StackItem>
            <Title headingLevel="h4" size={TitleSizes.lg} style={{ paddingBottom: '10px' }}>
              Configuration Analysis
            </Title>
          </StackItem>
          {(this.props.messages || []).map((msg: ValidationMessage, i: number) => {
            const severity: ValidationTypes = IstioLevelToSeverity[msg.level || 'UNKNOWN'];
            return (
              <StackItem id={'msg-' + i}>
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
              const severity: ValidationTypes = IstioLevelToSeverity[check.severity.toUpperCase() || 'UNKNOWN'];
              return (
                <StackItem id={'valid_msg-' + index}>
                  <Flex>
                    <FlexItem>
                      <Validation severity={severity} />
                    </FlexItem>
                    <FlexItem>{check.code}</FlexItem>
                    <Tooltip content={check.message} position={TooltipPosition.right}>
                      <div className="iconInfo">
                        <KialiIcon.Info className={statusInfoStyle} />
                      </div>
                    </Tooltip>
                  </Flex>
                </StackItem>
              );
            })}
          </Stack>
        </Stack>
      </>
    );
  }
}
