import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { ExclamationTriangleIcon, ExclamationCircleIcon } from '@patternfly/react-icons';
import { isIstioNamespace } from 'config/ServerConfig';
import { ValidationTypes, ObjectValidation } from 'types/IstioObjects';
import { PFColors } from '../Pf/PfColors';
import { useKialiTranslation } from 'utils/I18nUtils';

type WorkloadConfigValidationProps = {
  className?: string;
  namespace: string;
  validations?: ObjectValidation;
};

export const WorkloadConfigValidation: React.FC<WorkloadConfigValidationProps> = ({
  className,
  namespace,
  validations
}) => {
  const { t } = useKialiTranslation();

  // Skip rendering for Istio namespaces
  if (isIstioNamespace(namespace)) {
    return <></>;
  }

  if (!validations || validations.checks.length === 0) {
    return <></>;
  }

  // Separate errors and warnings
  const errors = validations.checks.filter(check => check.severity === ValidationTypes.Error);
  const warnings = validations.checks.filter(check => check.severity === ValidationTypes.Warning);

  // Determine icon and color based on severity
  const hasErrors = errors.length > 0;
  const hasWarnings = warnings.length > 0;

  let icon: React.ComponentClass<SVGIconProps>;
  let color: string;
  let tooltipContent: string;
  const errorCountStr = hasErrors
    ? t('{{count}} error', {
        count: errors.length,
        defaultValueOne: '{{count}} error',
        defaultValueOther: '{{count}} errors'
      })
    : '';
  const warningCountStr = hasWarnings
    ? t('{{count}} warning', {
        count: warnings.length,
        defaultValueOne: '{{count}} warning',
        defaultValueOther: '{{count}} warnings'
      })
    : '';

  if (hasErrors) {
    icon = ExclamationCircleIcon;
    color = PFColors.Danger;
    const headerSummary = `${t('Config Issues')} (${errorCountStr}, ${warningCountStr})`;
    const errorsList = `${t('Errors')}:\n${errors
      .map(e => `• ${e.code ? `${e.code} - ` : ''}${e.message}`)
      .join('\n')}`;
    const warningsList = hasWarnings
      ? `${t('Warnings')}:\n${warnings.map(w => `• ${w.code ? `${w.code} - ` : ''}${w.message}`).join('\n')}`
      : '';
    tooltipContent = [headerSummary, errorsList, warningsList].join('\n');
  } else if (hasWarnings) {
    icon = ExclamationTriangleIcon;
    color = PFColors.Warning;
    const headerSummary = `${t('Config Issues')} (${warningCountStr}):`;
    const warningsList = warnings.map(w => `• ${w.code ? `${w.code} - ` : ''}${w.message}`).join('\n');
    tooltipContent = [headerSummary, warningsList].join('\n');
  } else {
    return <></>;
  }

  const iconComponent = (
    <span className={className}>
      {React.createElement(icon, { style: { color: color } })}
      <span style={{ marginLeft: '0.5rem' }}>{t('Config Issues')}</span>
    </span>
  );

  return (
    <Tooltip
      content={<div style={{ textAlign: 'left', whiteSpace: 'pre-line' }}>{tooltipContent}</div>}
      position={TooltipPosition.top}
    >
      {iconComponent}
    </Tooltip>
  );
};
