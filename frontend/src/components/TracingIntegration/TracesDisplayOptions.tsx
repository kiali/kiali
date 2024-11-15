import * as React from 'react';
import {
  Checkbox,
  Dropdown,
  DropdownList,
  MenuToggle,
  MenuToggleElement,
  Radio,
  Tooltip,
  TooltipPosition
} from '@patternfly/react-core';
import { itemStyleWithoutInfo, menuStyle, titleStyle } from 'styles/DropdownStyles';
import { HistoryManager, URLParam } from 'app/History';
import { KialiIcon } from 'config/KialiIcon';
import { TraceLimit } from 'components/Metrics/TraceLimit';
import { infoStyle } from 'styles/IconStyle';

export interface QuerySettings {
  errorsOnly: boolean;
  limit: number;
  percentile?: string;
}

export interface DisplaySettings {
  showSpansAverage: boolean;
}

export const percentilesOptions: DisplayOptionType[] = [
  { id: 'all', labelText: 'All' },
  { id: '0.75', labelText: 'p75' },
  { id: '0.9', labelText: 'p90' },
  { id: '0.99', labelText: 'p99' }
];

interface Props {
  disabled: boolean;
  onDisplaySettingsChanged: (settings: DisplaySettings) => void;
  onQuerySettingsChanged: (settings: QuerySettings) => void;
  percentilesPromise: Promise<Map<string, number>>;
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
  private computedPercentiles: Map<string, number> | undefined;

  constructor(props: Props) {
    super(props);

    const displaySettings = TracesDisplayOptions.retrieveDisplaySettings();
    const querySettings = TracesDisplayOptions.retrieveQuerySettings();
    this.state = { ...displaySettings, ...querySettings, isOpen: false };
    props.percentilesPromise.then(p => (this.computedPercentiles = p));
  }

  public static retrieveDisplaySettings(): DisplaySettings {
    const spansAverage =
      HistoryManager.getParam(URLParam.TRACING_SHOW_SPANS_AVG) ||
      sessionStorage.getItem(URLParam.TRACING_SHOW_SPANS_AVG) ||
      'false';

    return {
      showSpansAverage: spansAverage === 'true'
    };
  }

  public static retrieveQuerySettings(): QuerySettings {
    const limit =
      HistoryManager.getParam(URLParam.TRACING_LIMIT_TRACES) ||
      sessionStorage.getItem(URLParam.TRACING_LIMIT_TRACES) ||
      '100';

    const errorsOnly =
      HistoryManager.getParam(URLParam.TRACING_ERRORS_ONLY) ||
      sessionStorage.getItem(URLParam.TRACING_ERRORS_ONLY) ||
      'false';

    const percentile =
      HistoryManager.getParam(URLParam.TRACING_PERCENTILE) ||
      sessionStorage.getItem(URLParam.TRACING_PERCENTILE) ||
      undefined;

    return {
      errorsOnly: errorsOnly === 'true',
      limit: Number(limit),
      percentile: percentile
    };
  }

  private onToggle = (isOpen): void => {
    this.setState({ isOpen: isOpen });
  };

  render(): React.ReactNode {
    const { isOpen } = this.state;

    return (
      <Dropdown
        toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
          <MenuToggle
            ref={toggleRef}
            id={'traces-display-settings'}
            onClick={() => this.onToggle(!isOpen)}
            isExpanded={isOpen}
          >
            Display
          </MenuToggle>
        )}
        isOpen={isOpen}
        onOpenChange={(isOpen: boolean) => this.onToggle(isOpen)}
      >
        <DropdownList>{this.getPopoverContent()}</DropdownList>
      </Dropdown>
    );
  }

  private getPopoverContent(): React.ReactNode {
    return (
      <div id="traces-display-menu" className={menuStyle}>
        <div style={{ marginTop: '0.5rem' }}>
          <span className={titleStyle} style={{ paddingRight: 0 }}>
            Filter by percentile
          </span>
          <Tooltip
            key="tooltip_filter_by_percentile"
            position={TooltipPosition.right}
            content={
              <div style={{ textAlign: 'left' }}>
                <div>
                  These percentiles are computed from metrics. To refresh them, reload the page. The filter applies on
                  span durations. Thus, the filtered traces are the ones where at least one span for the service
                  satisfies the duration criteria.
                </div>
              </div>
            }
          >
            <KialiIcon.Info className={infoStyle} />
          </Tooltip>
        </div>

        {percentilesOptions.map(item => {
          let label = item.labelText;
          if (this.computedPercentiles) {
            const val = this.computedPercentiles!.get(item.id);
            if (val) {
              label += ` (${val.toFixed(2)}ms+)`;
            }
          }
          return (
            <div key={item.id}>
              <label key={item.id} className={itemStyleWithoutInfo}>
                <Radio
                  id={item.id}
                  name={`percentiles${item.id}`}
                  isChecked={item.id === this.state.percentile || (item.id === 'all' && !this.state.percentile)}
                  label={label}
                  onChange={(_event, checked) => this.onPercentileChanged(item.id, checked)}
                  value={item.id}
                />
              </label>
            </div>
          );
        })}

        <div className={titleStyle}>Errors</div>
        <div>
          <label className={itemStyleWithoutInfo}>
            <Checkbox
              id="errors-only"
              name="errors-only"
              isChecked={this.state.errorsOnly}
              label="Show only traces with errors"
              onChange={(_event, checked: boolean) => this.onErrorsOnlyChanged(checked)}
              value="errors-only"
            />
          </label>
        </div>

        <TraceLimit
          asRadio={true}
          initialLimit={this.state.limit}
          onLimitChange={this.onLimitChanged}
          title="Trace limit"
          titleClassName={titleStyle}
        />

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

  private onPercentileChanged = (id: string, checked: boolean): void => {
    if (checked) {
      this.saveValue(URLParam.TRACING_PERCENTILE, id);
      this.setState({ percentile: id }, () => this.props.onQuerySettingsChanged(this.state));
    }
  };

  private onErrorsOnlyChanged = (checked: boolean): void => {
    this.saveValue(URLParam.TRACING_ERRORS_ONLY, String(checked));
    this.setState({ errorsOnly: checked }, () => this.props.onQuerySettingsChanged(this.state));
  };

  private onLimitChanged = (limit: number): void => {
    this.saveValue(URLParam.TRACING_LIMIT_TRACES, String(limit));
    this.setState({ limit: limit }, () => this.props.onQuerySettingsChanged(this.state));
  };

  private onValueAxisChanged = (showSpansAverage: boolean): void => {
    this.saveValue(URLParam.TRACING_SHOW_SPANS_AVG, String(showSpansAverage));
    this.setState({ showSpansAverage: showSpansAverage }, () => this.props.onDisplaySettingsChanged(this.state));
  };

  private saveValue = (key: URLParam, value: string): void => {
    sessionStorage.setItem(key, value);
    HistoryManager.setParam(key, value);
  };
}
