import * as React from 'react';
import { UserSettingsActions } from 'actions/UserSettingsActions';
import { HistoryManager, URLParam } from 'app/History';
import { useKialiDispatch } from 'hooks/redux';
import { kialiStyle } from 'styles/StyleUtils';
import { t } from 'utils/I18nUtils';
import { getHealthComputeDurationLabel, healthComputeDurationValidSeconds } from 'utils/HealthComputeDuration';

const durationLabelStyle = kialiStyle({
  fontSize: '0.875rem',
  fontWeight: 400,
  color: 'var(--pf-global--Color--200)',
  whiteSpace: 'nowrap'
});

const rightToolbarStyle = kialiStyle({
  display: 'flex',
  alignItems: 'center',
  gap: '0.75rem'
});

type HealthComputeDurationMastheadToolbarProps = {
  children: React.ReactNode;
};

/**
 * Shows the health compute duration (same source as cached list/overview health) and syncs Redux + URL
 * duration so detail pages use the same window after navigating from these pages.
 */
export const HealthComputeDurationMastheadToolbar: React.FC<HealthComputeDurationMastheadToolbarProps> = ({
  children
}) => {
  const dispatch = useKialiDispatch();

  // this is basically a mount-only effect, the server config doesn't change
  React.useEffect(() => {
    const secs = healthComputeDurationValidSeconds();
    dispatch(UserSettingsActions.setDuration(secs));
    HistoryManager.setParam(URLParam.DURATION, String(secs));
  }, [dispatch]);

  const durationLabel = getHealthComputeDurationLabel();

  return (
    <div className={rightToolbarStyle}>
      <span className={durationLabelStyle}>{t('Last {{duration}}', { duration: durationLabel })}</span>
      {children}
    </div>
  );
};
