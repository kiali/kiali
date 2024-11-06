import * as React from 'react';
import { Radio, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';
import { itemInfoStyle, itemStyleWithoutInfo } from 'styles/DropdownStyles';
import { ToolbarDropdown } from 'components/Dropdown/ToolbarDropdown';
import { useKialiTranslation } from 'utils/I18nUtils';

export const TRACE_LIMIT_DEFAULT = 100;

type TraceLimitProps = {
  asRadio?: boolean;
  initialLimit?: number;
  onLimitChange: (limit: number) => void;
  title?: string;
  titleClassName?: string;
};

export const TraceLimit: React.FC<TraceLimitProps> = (props: TraceLimitProps) => {
  const initialLimit = props.initialLimit ?? TRACE_LIMIT_DEFAULT;
  const [limit, setLimit] = React.useState<number>(initialLimit);
  const { t } = useKialiTranslation();

  const onLimitChangeRadio = (limit: number, checked): void => {
    if (checked) {
      setLimit(limit);
      props.onLimitChange(limit);
    }
  };

  const onLimitChange = (limitStr: string): void => {
    const limit = parseInt(limitStr);
    props.onLimitChange(limit);
    setLimit(limit);
  };

  const tooltip = (
    <Tooltip
      key="tooltip_limit_per_query"
      position={TooltipPosition.right}
      content={
        <div style={{ textAlign: 'left' }}>
          <div>
            This limits the number of traces that will be fetched. If the number of fetched traces does not sufficiently
            cover the desired time period, increase the limit or reduce the time period. Query time may increase for
            larger limits and/or time periods. A custom time period may also be used.
          </div>
        </div>
      }
    >
      <KialiIcon.Info className={itemInfoStyle} />
    </Tooltip>
  );

  const traceLimitComponent = (
    <span>
      <div style={{ marginTop: '0.5rem' }}>
        <span className={props.titleClassName} style={{ paddingRight: 0 }}>
          {props.title ? props.title : t('Limit per query')}
        </span>
        {tooltip}
      </div>

      {[20, 100, 500, 1000].map(lim => (
        <div key={`limit-${lim}`}>
          <label key={`limit-${lim}`} className={itemStyleWithoutInfo}>
            <Radio
              id={`limit-${lim}`}
              name={`limit-${lim}`}
              isChecked={lim === limit}
              label={String(lim)}
              onChange={(_event, checked) => onLimitChangeRadio(lim, checked)}
              value={String(lim)}
            />
          </label>
        </div>
      ))}
    </span>
  );

  const traceOptions: { [key: string]: string } = {
    20: '20',
    100: '100',
    500: '500',
    1000: '1000'
  };

  const traceLimitDropdownComponent = (
    <span>
      <ToolbarDropdown
        id={'trace-limit-dropdown'}
        handleSelect={onLimitChange}
        nameDropdown={props.title ? props.title : t('limit')}
        nameDropdownClassName={props.titleClassName}
        value={limit}
        label={traceOptions[limit]}
        options={traceOptions}
      />
      {tooltip}
    </span>
  );

  return props.asRadio ? traceLimitComponent : traceLimitDropdownComponent;
};
