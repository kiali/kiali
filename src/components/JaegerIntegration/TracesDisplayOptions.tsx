import * as React from 'react';
import { Checkbox, Dropdown, DropdownToggle, Radio } from '@patternfly/react-core';

import { itemStyleWithoutInfo, menuStyle, titleStyle } from 'styles/DropdownStyles';
import { HistoryManager, URLParam } from 'app/History';

export interface QuerySettings {
  percentile?: string;
  errorsOnly: boolean;
  limit: number;
}

export interface DisplaySettings {
  fitToData: boolean;
  showSpansAverage: boolean;
}

interface Props {
  onQuerySettingsChanged: (settings: QuerySettings) => void;
  onDisplaySettingsChanged: (settings: DisplaySettings) => void;
}

type State = QuerySettings &
  DisplaySettings & {
    isOpen: boolean;
  };

interface DisplayOptionType {
  id: string;
  labelText: string;
}

export class TracesDisplayOptions extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    const displaySettings = TracesDisplayOptions.retrieveDisplaySettings();
    const querySettings = TracesDisplayOptions.retrieveQuerySettings();
    this.state = { ...displaySettings, ...querySettings, isOpen: false };
  }

  componentDidUpdate() {}

  public static retrieveDisplaySettings(): DisplaySettings {
    const fitToData =
      HistoryManager.getParam(URLParam.JAEGER_TIME_FITS_DATA) ||
      sessionStorage.getItem(URLParam.JAEGER_TIME_FITS_DATA) ||
      'false';
    const spansAverage =
      HistoryManager.getParam(URLParam.JAEGER_SHOW_SPANS_AVG) ||
      sessionStorage.getItem(URLParam.JAEGER_SHOW_SPANS_AVG) ||
      'false';
    return {
      fitToData: fitToData === 'true',
      showSpansAverage: spansAverage === 'true'
    };
  }

  public static retrieveQuerySettings(): QuerySettings {
    const limit =
      HistoryManager.getParam(URLParam.JAEGER_LIMIT_TRACES) ||
      sessionStorage.getItem(URLParam.JAEGER_LIMIT_TRACES) ||
      '100';
    const errorsOnly =
      HistoryManager.getParam(URLParam.JAEGER_ERRORS_ONLY) ||
      sessionStorage.getItem(URLParam.JAEGER_ERRORS_ONLY) ||
      'false';
    const percentile =
      HistoryManager.getParam(URLParam.JAEGER_PERCENTILE) ||
      sessionStorage.getItem(URLParam.JAEGER_PERCENTILE) ||
      undefined;
    return {
      errorsOnly: errorsOnly === 'true',
      limit: Number(limit),
      percentile: percentile
    };
  }

  private onToggle = isOpen => {
    this.setState({ isOpen: isOpen });
  };

  render() {
    const { isOpen } = this.state;
    return (
      <Dropdown
        toggle={
          <DropdownToggle id={'traces-display-settings'} onToggle={this.onToggle}>
            Display
          </DropdownToggle>
        }
        isOpen={isOpen}
      >
        {this.getPopoverContent()}
      </Dropdown>
    );
  }

  private getPopoverContent() {
    const percentiles: DisplayOptionType[] = [
      { id: 'all', labelText: 'All' },
      { id: '0.75', labelText: 'p75 and above' },
      { id: '0.9', labelText: 'p90 and above' },
      { id: '0.99', labelText: 'p99 and above' }
    ];

    return (
      <div id="traces-display-menu" className={menuStyle}>
        <div className={titleStyle}>Filter by percentile</div>
        {percentiles.map(item => (
          <div key={item.id}>
            <label key={item.id} className={itemStyleWithoutInfo}>
              <Radio
                id={item.id}
                name={'percentiles' + item.id}
                isChecked={item.id === this.state.percentile || (item.id === 'all' && !this.state.percentile)}
                label={item.labelText}
                onChange={checked => this.onPercentileChanged(item.id, checked)}
                value={item.id}
              />
            </label>
          </div>
        ))}
        <div className={titleStyle}>Errors</div>
        <div>
          <label className={itemStyleWithoutInfo}>
            <Checkbox
              id="errors-only"
              name="errors-only"
              isChecked={this.state.errorsOnly}
              label="Show only traces with errors"
              onChange={this.onErrorsOnlyChanged}
              value="errors-only"
            />
          </label>
        </div>
        <div className={titleStyle}>Limit per query</div>
        {[20, 100, 500, 1000].map(limit => (
          <div key={'limit-' + limit}>
            <label key={'limit-' + limit} className={itemStyleWithoutInfo}>
              <Radio
                id={'limit-' + limit}
                name={'limit-' + limit}
                isChecked={this.state.limit === limit}
                label={String(limit)}
                onChange={checked => this.onLimitChanged(limit, checked)}
                value={String(limit)}
              />
            </label>
          </div>
        ))}
        <div className={titleStyle}>Time axis</div>
        <div>
          <label className={itemStyleWithoutInfo}>
            <Radio
              id="xaxis-fit-data"
              name="xaxis-fit-data"
              isChecked={this.state.fitToData}
              label="Fit to data"
              onChange={() => this.onTimeAxisChanged(true)}
              value="xaxis-fit-data"
            />
          </label>
        </div>
        <div>
          <label className={itemStyleWithoutInfo}>
            <Radio
              id="xaxis-fit-time"
              name="xaxis-fit-time"
              isChecked={!this.state.fitToData}
              label="Fit to selected interval"
              onChange={() => this.onTimeAxisChanged(false)}
              value="xaxis-fit-time"
            />
          </label>
        </div>
        <div className={titleStyle}>Value axis</div>
        <div>
          <label className={itemStyleWithoutInfo}>
            <Radio
              id="yaxis-full"
              name="yaxis-full"
              isChecked={!this.state.showSpansAverage}
              label="Full trace duration"
              onChange={() => this.onValueAxisChanged(false)}
              value="yaxis-full"
            />
          </label>
        </div>
        <div>
          <label className={itemStyleWithoutInfo}>
            <Radio
              id="yaxis-avg"
              name="yaxis-avg"
              isChecked={this.state.showSpansAverage}
              label="Spans average duration"
              onChange={() => this.onValueAxisChanged(true)}
              value="yaxis-avg"
            />
          </label>
        </div>
      </div>
    );
  }

  private onPercentileChanged = (id: string, checked: boolean) => {
    if (checked) {
      this.saveValue(URLParam.JAEGER_PERCENTILE, id);
      this.setState({ percentile: id }, () => this.props.onQuerySettingsChanged(this.state));
    }
  };

  private onErrorsOnlyChanged = (checked: boolean) => {
    this.saveValue(URLParam.JAEGER_ERRORS_ONLY, String(checked));
    this.setState({ errorsOnly: checked }, () => this.props.onQuerySettingsChanged(this.state));
  };

  private onLimitChanged = (limit: number, checked: boolean) => {
    if (checked) {
      this.saveValue(URLParam.JAEGER_LIMIT_TRACES, String(limit));
      this.setState({ limit: limit }, () => this.props.onQuerySettingsChanged(this.state));
    }
  };

  private onTimeAxisChanged = (fitToData: boolean) => {
    this.saveValue(URLParam.JAEGER_TIME_FITS_DATA, String(fitToData));
    this.setState({ fitToData: fitToData }, () => this.props.onDisplaySettingsChanged(this.state));
  };

  private onValueAxisChanged = (showSpansAverage: boolean) => {
    this.saveValue(URLParam.JAEGER_SHOW_SPANS_AVG, String(showSpansAverage));
    this.setState({ showSpansAverage: showSpansAverage }, () => this.props.onDisplaySettingsChanged(this.state));
  };

  private saveValue = (key: URLParam, value: string) => {
    sessionStorage.setItem(key, value);
    HistoryManager.setParam(key, value);
  };
}
