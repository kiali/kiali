import { ExclamationCircleIcon, ExclamationTriangleIcon, InfoCircleIcon } from '@patternfly/react-icons';
import * as React from 'react';

import { PFColors } from 'components/Pf/PfColors';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontWeight } from 'styles/PfTypography';
import type { TroubleshootingSubProblem, TroubleshootingValidationCheck } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

const problemStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.sm
});

const checksStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.sm
});

const checkStyle = kialiStyle({
  alignItems: 'baseline',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.xs
});

const checkCodeStyle = kialiStyle({
  fontWeight: PFFontWeight.BodyBold
});

const dangerIconStyle = kialiStyle({
  color: PFColors.Danger,
  flexShrink: 0
});

const warningIconStyle = kialiStyle({
  color: PFColors.Warning,
  flexShrink: 0
});

const infoIconStyle = kialiStyle({
  color: PFColors.Info,
  flexShrink: 0
});

const severityIcon = (severity?: string): React.ReactNode => {
  switch (severity) {
    case 'critical':
      return <ExclamationCircleIcon aria-label={t('Critical')} className={dangerIconStyle} />;
    case 'warning':
      return <ExclamationTriangleIcon aria-label={t('Warning')} className={warningIconStyle} />;
    default:
      return <InfoCircleIcon aria-label={t('Info')} className={infoIconStyle} />;
  }
};

const checkText = (check: TroubleshootingValidationCheck): string =>
  check.path ? `${check.message} (${check.path})` : check.message;

export const TroubleshootingProblemInfo: React.FC<{ subProblem: TroubleshootingSubProblem }> = ({ subProblem }) => {
  const checks = subProblem.checks ?? [];

  if (!subProblem.impact && checks.length === 0) {
    return null;
  }

  return (
    <div className={problemStyle}>
      {subProblem.impact && <p data-test="ai-troubleshooting-analysis-summary">{subProblem.impact}</p>}
      {checks.length > 0 && (
        <div className={checksStyle} data-test="ai-troubleshooting-analysis-checks">
          {checks.map(check => (
            <div className={checkStyle} key={`${check.code}-${check.path ?? ''}-${check.message}`}>
              <span className={checkCodeStyle}>{`[${check.code}]`}</span>
              {severityIcon(check.severity)}
              <span>{checkText(check)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
