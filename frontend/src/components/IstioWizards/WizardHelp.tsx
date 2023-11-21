import * as React from 'react';
import { Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from '../../config/KialiIcon';
import { kialiStyle } from 'styles/StyleUtils';
import i18n from 'locales/i18n';

const infoStyle = kialiStyle({
  marginLeft: '0.5rem'
});

const importantTooltip = kialiStyle({
  fontWeight: 700
});

export const wizardTooltip = (tooltipContent: React.ReactFragment) => {
  return (
    <Tooltip position={TooltipPosition.right} content={<div style={{ textAlign: 'left' }}>{tooltipContent}</div>}>
      <KialiIcon.Info className={infoStyle} />
    </Tooltip>
  );
};

export const CONNECTION_POOL_TOOLTIP = (
  <>
    <div style={{ marginBottom: 5 }}>{i18n.t('tip17')}</div>
    <div style={{ marginBottom: 5 }}>{i18n.t('tip18')}</div>
    <div>
      Connection pool settings can be applied at the <span className={importantTooltip}>TCP</span> level as well as at{' '}
      <span className={importantTooltip}>HTTP</span> level.
    </div>
  </>
);

export const GATEWAY_TOOLTIP = (
  <>
    <div style={{ marginBottom: 5 }}>{i18n.t('tip19')}</div>
    <div style={{ marginBottom: 5 }}>{i18n.t('tip20')}</div>
    <div>
      {i18n.t('tip21')} <span className={importantTooltip}>{i18n.t('mesh')}</span>.
    </div>
  </>
);

export const HTTP_ABORT_TOOLTIP = (
  <>
    Abort HTTP request attempts and return error codes back to <span className={importantTooltip}>DOWNSTREAM</span>{' '}
    service, giving the impression that the <span className={importantTooltip}>UPSTREAM</span> service is faulty.
  </>
);

export const HTTP_DELAY_TOOLTIP = (
  <>
    Delay requests <span className={importantTooltip}>BEFORE</span> forwarding, emulating various failures such as
    network issues, overloaded upstream service, etc.
  </>
);

export const HTTP_RETRY_TOOLTIP = <>{i18n.t('helpTip31')}</>;

export const HTTP_TIMEOUT_TOOLTIP = <>{i18n.t('helpTip32')}</>;

export const LOAD_BALANCER_TOOLTIP = <>{i18n.t('helpTip33')}</>;

export const MATCHING_SELECTED_TOOLTIP = (
  <>
    <div style={{ marginBottom: 5 }}>{i18n.t('helpTip34')}</div>
    <div>
      Kiali Wizard will create all conditions with an <span className={importantTooltip}>OR</span> semantic.
    </div>
  </>
);

export const FILTERING_SELECTED_TOOLTIP = (
  <>
    <div style={{ marginBottom: 5 }}>{i18n.t('helpTip35')}</div>
    <div>
      Kiali Wizard will create all conditions with an <span className={importantTooltip}>OR</span> semantic.
    </div>
  </>
);

export const OUTLIER_DETECTION_TOOLTIP = (
  <>
    <div style={{ marginBottom: 5 }}>
      A Circuit breaker implementation that tracks the status of each individual host in the{' '}
      <span className={importantTooltip}>upstream</span> service.{' '}
    </div>
    <div style={{ marginBottom: 5 }}>
      For <span className={importantTooltip}>HTTP</span> services, hosts that continually return 5xx errors for API
      calls are ejected from the pool for a pre-defined period of time.
    </div>
    <div>
      For <span className={importantTooltip}>TCP</span> services, connection timeouts or connection failures to a given
      host counts as an error when measuring the consecutive errors metric.
    </div>
  </>
);

export const PEER_AUTHENTICATION_TOOLTIP = (
  <>
    <div style={{ marginBottom: 5 }}>{i18n.t('helpTip36')}</div>
    <div>
      Defines the <span className={importantTooltip}>mTLS</span> mode used for peer authentication.
    </div>
  </>
);

export const ROUTE_RULES_TOOLTIP = (
  <>
    <div style={{ marginBottom: 5 }}>{i18n.t('helpTip37')}</div>
    <div>
      The first rule <span className={importantTooltip}>MATCHING</span> an incoming request is used.
    </div>
  </>
);
