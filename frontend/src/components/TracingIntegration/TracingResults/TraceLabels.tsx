import * as React from 'react';
import { Label, pluralize } from '@patternfly/react-core';

import { PFColors } from 'components/Pf/PfColors';
import { Span } from 'types/TracingInfo';
import { isErrorTag } from 'utils/tracing/TracingHelper';
import { kialiStyle } from 'styles/StyleUtils';

/**
 * PF4 adds a wrapper for the label content
 * And the label color is override by .pf-v5-c-label__content
 * And there are not styles with the color white
 */
const whiteLabelStyle = kialiStyle({
  $nest: {
    '& > .pf-v5-c-label__content': {
      color: PFColors.Color100
    }
  }
});

type Props = {
  spans: Span[];
  filteredSpans?: Span[];
  oneline: boolean;
};

const countServices = (spans: Span[]) => {
  const services = new Set();
  spans.forEach(s => services.add(s.process.serviceName));
  return services.size;
};

const countErrors = (spans: Span[]) => {
  return spans.filter(sp => sp.tags.some(isErrorTag)).length;
};

export const TraceLabels = (p: Props) => {
  const errors = countErrors(p.spans);
  const filteredErrors = p.filteredSpans ? countErrors(p.filteredSpans) : undefined;
  return (
    <>
      <Label style={{ margin: 10 }} color="blue">
        {p.filteredSpans && `${p.filteredSpans.length} / `}
        {pluralize(p.spans.length, 'Span')}
      </Label>
      <Label style={{ margin: 10 }} color="blue">
        {p.filteredSpans && `${countServices(p.filteredSpans)} / `}
        {pluralize(countServices(p.spans), 'App')} involved
      </Label>
      {!p.oneline && <br />}
      {errors === 0 ? (
        <Label className={whiteLabelStyle} style={{ margin: 10, backgroundColor: PFColors.Success }}>
          0 Spans with error
        </Label>
      ) : (
        <Label
          className={whiteLabelStyle}
          style={{ margin: 10, backgroundColor: filteredErrors === 0 ? PFColors.Warning : PFColors.Danger }}
        >
          {p.filteredSpans && `${filteredErrors} / `}
          {pluralize(errors, 'Span')} with error
        </Label>
      )}
    </>
  );
};
