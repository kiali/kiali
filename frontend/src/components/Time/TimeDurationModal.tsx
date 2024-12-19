import * as React from 'react';
import { Button, Form, FormGroup, Modal, ModalVariant, TooltipPosition } from '@patternfly/react-core';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { HistoryManager, location, URLParam } from '../../app/History';
import { useKialiDispatch, useKialiSelector } from '../../hooks/redux';
import { DurationInSeconds, IntervalInMilliseconds, TimeRange } from '../../types/Common';
import { DurationDropdownComponent } from '../Dropdown/DurationDropdown';
import { RefreshComponent } from '../Refresh/Refresh';
import { TimeRangeComp } from './TimeRangeComponent';
import { kioskDurationAction, kioskTimeRangeAction } from '../Kiosk/KioskActions';
import { useKialiTranslation } from 'utils/I18nUtils';
import { toValidDuration } from '../../config/ServerConfig';
import { config } from '../../config';

interface Props {
  customDuration: boolean;
  isOpen: boolean;

  onCancel?: () => void;
  onConfirm?: () => void;
}

export const TimeDurationModal: React.FC<Props> = (props: Props) => {
  const dispatch = useKialiDispatch();
  const { t, i18n } = useKialiTranslation();

  const reduxDuration = useKialiSelector(state => state.userSettings.duration);
  const reduxRefreshInterval = useKialiSelector(state => state.userSettings.refreshInterval);
  const reduxTimeRange = useKialiSelector(state => state.userSettings.timeRange);

  const urlParams = new URLSearchParams(location.getSearch());
  const urlDuration = HistoryManager.getDuration(urlParams);
  const urlRefresh = HistoryManager.getNumericParam(URLParam.REFRESH_INTERVAL, urlParams);
  const urlTimeRange = HistoryManager.getNumericParam(URLParam.RANGE_DURATION, urlParams);
  const urlFrom = HistoryManager.getNumericParam(URLParam.FROM, urlParams);
  const urlTo = HistoryManager.getNumericParam(URLParam.TO, urlParams);

  const getInitDuration = (): number => {
    if (!props.customDuration && urlDuration) {
      return toValidDuration(urlDuration);
    }
    return reduxDuration;
  };

  const getInitRefresh = (): number => {
    if (urlRefresh) {
      // Validate value
      if (urlRefresh === 0 || config.toolbar.refreshInterval[urlRefresh]) {
        return urlRefresh;
      }
    }
    return reduxRefreshInterval;
  };

  const getUrlTimeRange = (): TimeRange => ({
    ...(urlTimeRange != null && { rangeDuration: urlTimeRange }),
    ...(urlFrom != null && { from: urlFrom }),
    ...(urlTo != null && { to: urlTo })
  });

  const getInitTimeRange = (): TimeRange => {
    const tm = getUrlTimeRange();

    if (!tm.rangeDuration && !tm.from && !tm.to && props.customDuration) {
      return reduxTimeRange;
    }

    return tm;
  };

  const [duration, setDuration] = React.useState(0);
  const [refreshInterval, setRefreshInterval] = React.useState(0);
  const [timeRange, setTimeRange] = React.useState<TimeRange>({});

  React.useEffect(() => {
    setDuration(getInitDuration());
    setRefreshInterval(getInitRefresh());
    setTimeRange(getInitTimeRange());

    if (urlDuration !== undefined) {
      dispatch(UserSettingsActions.setDuration(urlDuration));
    }
    // Update just when valid
    if (urlRefresh !== undefined && (urlRefresh === 0 || config.toolbar.refreshInterval[urlRefresh])) {
      dispatch(UserSettingsActions.setRefreshInterval(urlRefresh));
    }
    if (getUrlTimeRange() !== undefined) {
      dispatch(UserSettingsActions.setTimeRange(getUrlTimeRange()));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancel = (): void => {
    // reset the dialog
    setDuration(reduxDuration);
    setRefreshInterval(reduxRefreshInterval);
    setTimeRange(reduxTimeRange);
    HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(reduxRefreshInterval));

    if (props.onCancel) {
      props.onCancel();
    }
  };

  const handleConfirm = (): void => {
    dispatch(UserSettingsActions.setRefreshInterval(refreshInterval));
    HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(refreshInterval));

    if (!props.customDuration) {
      dispatch(UserSettingsActions.setDuration(duration));
      HistoryManager.setParam(URLParam.DURATION, String(duration));
      kioskDurationAction(duration);
    } else {
      timeRange.rangeDuration
        ? HistoryManager.setParam(URLParam.RANGE_DURATION, String(timeRange.rangeDuration))
        : HistoryManager.deleteParam(URLParam.RANGE_DURATION);
      timeRange.from
        ? HistoryManager.setParam(URLParam.FROM, String(timeRange.from))
        : HistoryManager.deleteParam(URLParam.FROM);
      timeRange.to
        ? HistoryManager.setParam(URLParam.TO, String(timeRange.to))
        : HistoryManager.deleteParam(URLParam.TO);

      dispatch(UserSettingsActions.setTimeRange(timeRange));
      kioskTimeRangeAction(timeRange);
    }

    if (props.onConfirm) {
      props.onConfirm();
    }
  };

  const handleSetDuration = (d: DurationInSeconds): void => {
    setDuration(d);
  };

  const handleSetRefreshInterval = (r: IntervalInMilliseconds): void => {
    setRefreshInterval(r);
  };

  const handleSetTimeRange = (r: TimeRange): void => {
    setTimeRange(r);
  };

  return (
    <Modal
      id="time-duration-modal"
      aria-label={t('Time duration')}
      variant={ModalVariant.small}
      width={700}
      isOpen={props.isOpen}
      showClose={false}
      actions={[
        <Button key="confirm" variant="primary" onClick={handleConfirm}>
          {t('Confirm')}
        </Button>,

        <Button key="cancel" variant="link" onClick={handleCancel}>
          {t('Cancel')}
        </Button>
      ]}
      position="top"
    >
      <Form isHorizontal={true}>
        {props.customDuration ? (
          <FormGroup label={t('Time range')} fieldId="drform-time-range">
            <div style={{ display: 'flex' }}>
              <TimeRangeComp timeRange={timeRange} setTimeRange={handleSetTimeRange} tooltip={t('Time range')} />
            </div>
          </FormGroup>
        ) : (
          <FormGroup label={t('Duration')} fieldId="drform-duration">
            <DurationDropdownComponent
              id={'drform-duration-dd'}
              disabled={false}
              duration={duration}
              prefix={t('Last')}
              setDuration={handleSetDuration}
              tooltip={t('Traffic metrics per refresh')}
              tooltipPosition={TooltipPosition.top}
            />
          </FormGroup>
        )}

        <FormGroup label={t('Refresh interval')} fieldId="drform-refresh">
          <RefreshComponent
            id="drform-metrics-refresh"
            hideLabel={true}
            hideRefreshButton={true}
            language={i18n.language}
            refreshInterval={refreshInterval}
            setRefreshInterval={handleSetRefreshInterval}
          />
        </FormGroup>
      </Form>
    </Modal>
  );
};
