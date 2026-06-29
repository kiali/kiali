import * as React from 'react';
import { Stack, StackItem, Title, TitleSizes } from '@patternfly/react-core';
import { IstioLevelToSeverity } from 'types/IstioObjects';
import type { ObjectCheck, ValidationMessage, ValidationTypes } from 'types/IstioObjects';
import { Validation } from 'components/Validations/Validation';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { useKialiTranslation } from 'utils/I18nUtils';

interface IstioStatusMessageListProps {
  checks?: ObjectCheck[];
  messages?: ValidationMessage[];
}

interface GroupedCheck {
  code?: string;
  count: number;
  message: string;
  severity: string;
}

const messageStyle = kialiStyle({
  paddingBottom: PFSpacer.sm
});

const groupChecks = (checks: ObjectCheck[]): GroupedCheck[] => {
  const grouped = new Map<string, GroupedCheck>();

  for (const check of checks) {
    const key = `${check.code ?? ''}_${check.severity}`;

    if (grouped.has(key)) {
      grouped.get(key)!.count++;
    } else {
      grouped.set(key, {
        code: check.code,
        count: 1,
        message: check.message,
        severity: check.severity
      });
    }
  }

  return Array.from(grouped.values());
};

export const IstioStatusMessageList: React.FC<IstioStatusMessageListProps> = ({ checks, messages }) => {
  const { t } = useKialiTranslation();

  const groupedChecks = React.useMemo(() => groupChecks(checks ?? []), [checks]);

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
          <StackItem key={`msg-${i}`} className={messageStyle}>
            <Validation severity={severity} />{' '}
            <a href={msg.documentationUrl} target="_blank" rel="noopener noreferrer">
              {msg.type.code}
            </a>
            {msg.description && ` ${msg.description}`}
          </StackItem>
        );
      })}

      {groupedChecks.map((group, index) => {
        const severity: ValidationTypes = IstioLevelToSeverity[group.severity.toUpperCase() || 'UNKNOWN'];

        return (
          <StackItem key={`valid_msg-${index}`} className={messageStyle}>
            <Validation severity={severity} /> {group.code} {group.message}
            {group.count > 1 && ` (${group.count})`}
          </StackItem>
        );
      })}
    </Stack>
  );
};
