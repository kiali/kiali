import * as React from 'react';
import { Checkbox } from '@patternfly/react-core';
import { TRACE_LIMIT_DEFAULT, TraceLimit } from './TraceLimit';

type TraceSpansLimitProps = {
  onChange: (checked: boolean, limit: number) => void;
  className?: string;
  inputClassName?: string;
  label?: string;
  labelClassName?: string;
  showSpans?: boolean;
  traceLimit?: number;
};

export const TraceSpansLimit: React.FC<TraceSpansLimitProps> = (props: TraceSpansLimitProps) => {
  const [showSpans, setShowSpans] = React.useState<boolean>(props.showSpans ?? false);
  let currentLimit = props.traceLimit ?? TRACE_LIMIT_DEFAULT;

  const onLimitChange = (limit: number): void => {
    currentLimit = limit;
    props.onChange(showSpans, currentLimit);
  };

  const onSpansChange = (_event, checked): void => {
    setShowSpans(checked);
    props.onChange(checked, currentLimit);
  };

  const traceSpansLimitComponent = (
    <span id="trace-spans-limit" style={{ display: 'flex' }}>
      <Checkbox
        className={props.className}
        id={`spans-show`}
        inputClassName={props.inputClassName}
        isChecked={showSpans}
        key={`spans-show`}
        label={showSpans ? '' : <span className={props.labelClassName}>{props.label}</span>}
        onChange={onSpansChange}
        style={showSpans ? { alignSelf: 'center' } : {}}
      />
      {showSpans && (
        <span style={{ marginLeft: '0.5rem' }}>
          <TraceLimit initialLimit={props.traceLimit} onLimitChange={onLimitChange} />
        </span>
      )}
    </span>
  );

  return traceSpansLimitComponent;
};
