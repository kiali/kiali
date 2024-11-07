import * as React from 'react';
import { useKialiTranslation } from 'utils/I18nUtils';
import { Checkbox } from '@patternfly/react-core';
import { TRACE_LIMIT_DEFAULT, TraceLimit } from './TraceLimit';

type TraceSpansLimitProps = {
  limitsAsRadio?: boolean; // if true use Dropdown, otherwise inline radio
  onSpansChange: (checked: boolean, limit: number) => void;
  showSpans?: boolean;
  showSpansLimit?: number;
  spansClassName?: string;
  spansInputClassName?: string;
  spansLabelClassName?: string;
  spansLabel?: string;
};

export const TraceSpansLimit: React.FC<TraceSpansLimitProps> = (props: TraceSpansLimitProps) => {
  const [showSpans, setShowSpans] = React.useState<boolean>(!!props.showSpans);
  const { t } = useKialiTranslation();
  let currentLimit = props.showSpansLimit ?? TRACE_LIMIT_DEFAULT;

  const onLimitChange = (limit: number): void => {
    currentLimit = limit;
    props.onSpansChange(showSpans, currentLimit);
  };

  const onSpansChange = (_event, checked): void => {
    setShowSpans(checked);
    props.onSpansChange(checked, currentLimit);
  };

  const label = props.spansLabel ? props.spansLabel : t('spans');

  const traceSpansLimitComponent = (
    <span id="trace-spans-limit" style={{ display: 'flex' }}>
      <Checkbox
        className={props.spansClassName}
        id={`spans-show`}
        inputClassName={props.spansInputClassName}
        isChecked={showSpans}
        key={`spans-show`}
        label={showSpans ? '' : <span className={props.spansLabelClassName}>{label}</span>}
        onChange={onSpansChange}
        style={showSpans ? { alignSelf: 'center' } : {}}
      />
      {showSpans && (
        <span style={{ marginLeft: '0.5rem' }}>
          <TraceLimit
            asRadio={props.limitsAsRadio}
            initialLimit={props.showSpansLimit}
            onLimitChange={onLimitChange}
            titleClassName={props.spansLabelClassName}
          />
        </span>
      )}
    </span>
  );

  return traceSpansLimitComponent;
};
