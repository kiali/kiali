import * as React from 'react';
import { connect } from 'react-redux';
import { KialiDispatch } from 'types/Redux';
import { KialiAppState } from '../../store/Store';
import { languageSelector, refreshIntervalSelector } from '../../store/Selectors';
import { config } from '../../config';
import { IntervalInMilliseconds } from '../../types/Common';
import { UserSettingsActions } from '../../actions/UserSettingsActions';
import { ToolbarDropdown } from '../Dropdown/ToolbarDropdown';
import { RefreshButton } from './RefreshButton';
import { HistoryManager, URLParam } from 'app/History';
import { TooltipPosition } from '@patternfly/react-core';
import { triggerRefresh } from '../../hooks/refresh';
import { isKioskMode } from '../../utils/SearchParamUtils';
import { kioskRefreshAction } from '../Kiosk/KioskActions';
import { t, tMap } from 'utils/I18nUtils';

type ReduxStateProps = {
  language: string;
  refreshInterval: IntervalInMilliseconds;
};

type ReduxDispatchProps = {
  setRefreshInterval: (refreshInterval: IntervalInMilliseconds) => void;
};

type ComponentProps = {
  disabled?: boolean;
  hideLabel?: boolean;
  hideRefreshButton?: boolean;
  id: string;
  manageURL?: boolean;
};

type Props = ComponentProps & ReduxStateProps & ReduxDispatchProps;

const REFRESH_INTERVALS = config.toolbar.refreshInterval;

export class RefreshComponent extends React.PureComponent<Props> {
  constructor(props: Props) {
    super(props);

    // Let URL override current redux state at construction time
    if (props.manageURL) {
      let refreshInterval = HistoryManager.getNumericParam(URLParam.REFRESH_INTERVAL);

      if (refreshInterval === undefined) {
        refreshInterval = props.refreshInterval;
      }

      if (refreshInterval !== props.refreshInterval) {
        props.setRefreshInterval(refreshInterval);
      }

      HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(refreshInterval));
    }
  }

  componentDidUpdate(): void {
    // ensure redux state and URL are aligned
    if (this.props.manageURL) {
      HistoryManager.setParam(URLParam.REFRESH_INTERVAL, String(this.props.refreshInterval));
    }
  }

  render(): React.ReactNode {
    if (this.props.refreshInterval !== undefined) {
      const { hideLabel } = this.props;
      return (
        <>
          {!hideLabel && <label style={{ paddingRight: '0.5em', marginLeft: '1.5em' }}>Refreshing</label>}

          <ToolbarDropdown
            id={this.props.id}
            handleSelect={value => this.updateRefreshInterval(Number(value))}
            value={String(this.props.refreshInterval)}
            label={t(REFRESH_INTERVALS[this.props.refreshInterval])}
            options={tMap(REFRESH_INTERVALS)}
            tooltip={t(
              'Refresh interval. "Pause" refreshes on page change or Refresh button click. "Manual" refreshes only on Refresh button click.'
            )}
            tooltipPosition={TooltipPosition.left}
          />

          {this.props.hideRefreshButton || (
            <RefreshButton handleRefresh={triggerRefresh} disabled={this.props.disabled} />
          )}
        </>
      );
    } else {
      return this.props.hideRefreshButton ? null : <RefreshButton handleRefresh={triggerRefresh} />;
    }
  }

  private updateRefreshInterval = (refreshInterval: IntervalInMilliseconds): void => {
    this.props.setRefreshInterval(refreshInterval); // notify redux of the change

    if (isKioskMode()) {
      kioskRefreshAction(refreshInterval);
    }
  };
}

const mapStateToProps = (state: KialiAppState): ReduxStateProps => ({
  language: languageSelector(state),
  refreshInterval: refreshIntervalSelector(state)
});

const mapDispatchToProps = (dispatch: KialiDispatch): ReduxDispatchProps => {
  return {
    setRefreshInterval: (refresh: IntervalInMilliseconds) => {
      dispatch(UserSettingsActions.setRefreshInterval(refresh));
    }
  };
};

export const Refresh = connect(mapStateToProps, mapDispatchToProps)(RefreshComponent);
