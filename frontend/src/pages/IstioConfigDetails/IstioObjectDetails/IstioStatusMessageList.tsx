import * as React from 'react';
import { Flex, FlexItem, Stack, StackItem, Title, TitleSizes, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { IstioLevelToSeverity, ObjectCheck, ValidationMessage, ValidationTypes } from 'types/IstioObjects';
import { Validation } from 'components/Validations/Validation';
import { KialiIcon } from 'config/KialiIcon';
import { useKialiTranslation } from 'utils/I18nUtils';

interface IstioStatusMessageListProps {
  checks?: ObjectCheck[];
  messages?: ValidationMessage[];
}

export const IstioStatusMessageList: React.FC<IstioStatusMessageListProps> = ({ checks, messages }) => {
  const { t } = useKialiTranslation();

  return (
    <Stack>
      <StackItem>
        <Title headingLevel="h4" size={TitleSizes.lg} style={{ paddingBottom: '10px' }}>
          {t('Configuration Analysis')}
        </Title>
      </StackItem>

      {(messages || []).map((msg: ValidationMessage, i: number) => {
        const severity: ValidationTypes = IstioLevelToSeverity[msg.level || 'UNKNOWN'];

        return (
          <StackItem key={`msg-${i}`}>
            <Flex>
              <FlexItem>
                <Validation severity={severity} />
              </FlexItem>
              <FlexItem>
                <a href={msg.documentationUrl} target="_blank" rel="noopener noreferrer">
                  {msg.type.code}
                </a>
              </FlexItem>
              <FlexItem>
                <Tooltip content={msg.description} position={TooltipPosition.right}>
                  <KialiIcon.Info />
                </Tooltip>
              </FlexItem>
            </Flex>
          </StackItem>
        );
      })}

      <Stack>
        {(checks ?? []).map((check, index) => {
          const severity: ValidationTypes = IstioLevelToSeverity[check.severity.toUpperCase() || 'UNKNOWN'];

          return (
            <StackItem key={`valid_msg-${index}`}>
              <Flex>
                <FlexItem>
                  <Validation severity={severity} />
                </FlexItem>
                <FlexItem>{check.code}</FlexItem>
                <Tooltip content={check.message} position={TooltipPosition.right}>
                  <KialiIcon.Info />
                </Tooltip>
              </Flex>
            </StackItem>
          );
        })}
      </Stack>
    </Stack>
  );
};
