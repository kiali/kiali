import * as React from 'react';
import { Label } from '@patternfly/react-core';
import { useSelector } from 'react-redux';
import { KialiAppState } from 'store/Store';
import { t } from 'utils/I18nUtils';

export const IstioAPIDisabledBadge: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  const istioAPIEnabled = useSelector((state: KialiAppState) => state.statusState.istioEnvironment.istioAPIEnabled);

  if (istioAPIEnabled) {
    return null;
  }

  return (
    <Label style={{ marginLeft: '0.5rem', ...style }} color="orange" isCompact data-test="istio-api-disabled-badge">
      {t('Istio API disabled')}
    </Label>
  );
};
