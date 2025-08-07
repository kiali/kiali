import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { SVGIconProps } from '@patternfly/react-icons/dist/js/createIcon';
import { ExclamationTriangleIcon, ExclamationCircleIcon } from '@patternfly/react-icons';
import { isIstioNamespace } from 'config/ServerConfig';
import { ValidationTypes, ObjectValidation } from 'types/IstioObjects';
import { PFColors } from '../Pf/PfColors';
import { useKialiTranslation } from 'utils/I18nUtils';
import { classes } from 'typestyle';
import { infoStyle } from '../../styles/IconStyle';
import { KialiIcon } from '../../config/KialiIcon';
import { kialiStyle } from '../../styles/StyleUtils';
import { Link } from 'react-router-dom-v5-compat';

type WorkloadConfigValidationProps = {
  className?: string;
  iconSize?: 'sm' | 'md';
  namespace: string;
  validations?: ObjectValidation;
};

const issuesInfoStyle = kialiStyle({
  marginLeft: '0.5rem',
  marginBottom: '0.125rem'
});

export const moreInfoLinkStyle = kialiStyle({
  display: 'flex',
  marginTop: '0.75rem',
  $nest: {
    '& > span': {
      marginRight: '0.5rem'
    }
  }
});

const iconSizeStyles = {
  sm: kialiStyle({
    width: '1em',
    height: '1em'
  }),
  md: kialiStyle({
    width: '1.25em',
    height: '1.25em'
  })
};

export const WorkloadConfigValidation: React.FC<WorkloadConfigValidationProps> = ({
  className,
  iconSize = 'sm',
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
  let tooltipContent: React.ReactNode;
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

  const moreInfo = (
    <div className={moreInfoLinkStyle}>
      <span>{t('More info at')}</span>
      <Link to="https://kiali.io/docs/features/validations" target="_blank" rel="noopener noreferrer">
        {t('Kiali.io Validations')}
      </Link>
    </div>
  );

  if (hasErrors) {
    icon = ExclamationCircleIcon;
    color = PFColors.Danger;
    const headerSummary = hasWarnings
      ? `${t('Config Issues')} (${errorCountStr}, ${warningCountStr})`
      : `${t('Config Issues')} (${errorCountStr})`;
    const errorsList = `${t('Errors')}:\n${errors
      .map(e => `• ${e.code ? `${e.code} - ` : ''}${e.message}`)
      .join('\n')}`;
    const warningsList = hasWarnings
      ? `${t('Warnings')}:\n${warnings.map(w => `• ${w.code ? `${w.code} - ` : ''}${w.message}`).join('\n')}`
      : '';
    tooltipContent = (
      <div style={{ textAlign: 'left', whiteSpace: 'pre-line' }}>
        <div>{headerSummary}</div>
        <div>{errorsList}</div>
        {hasWarnings && <div>{warningsList}</div>}
        {moreInfo}
      </div>
    );
  } else if (hasWarnings) {
    icon = ExclamationTriangleIcon;
    color = PFColors.Warning;
    const headerSummary = `${t('Config Issues')} (${warningCountStr}):`;
    const warningsList = warnings.map(w => `• ${w.code ? `${w.code} - ` : ''}${w.message}`).join('\n');

    tooltipContent = (
      <div style={{ textAlign: 'left', whiteSpace: 'pre-line' }}>
        <div>{headerSummary}</div>
        <div>{warningsList}</div>
        {moreInfo}
      </div>
    );
  } else {
    return <></>;
  }

  const iconComponent = (
    <span className={className}>
      {React.createElement(icon, {
        className: iconSizeStyles[iconSize],
        style: { color: color }
      })}
      <span style={{ marginLeft: '0.5rem' }}>{t('Config Issues')}</span>
      <KialiIcon.Info className={classes(infoStyle, issuesInfoStyle)} />
    </span>
  );

  return (
    <Tooltip content={tooltipContent} position={TooltipPosition.top}>
      {iconComponent}
    </Tooltip>
  );
};
