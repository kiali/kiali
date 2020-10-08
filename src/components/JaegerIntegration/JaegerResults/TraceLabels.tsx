import * as React from 'react';
import { Label, pluralize } from '@patternfly/react-core';

import { PFAlertColor } from 'components/Pf/PfColors';
import { Span } from 'types/JaegerInfo';
import { isErrorTag } from '../JaegerHelper';

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
      <Label style={{ margin: 10 }}>
        {p.filteredSpans && `${p.filteredSpans.length} / `}
        {pluralize(p.spans.length, 'Span')}
      </Label>
      <Label style={{ margin: 10 }}>
        {p.filteredSpans && `${countServices(p.filteredSpans)} / `}
        {pluralize(countServices(p.spans), 'App')} involved
      </Label>
      {!p.oneline && <br />}
      {errors === 0 ? (
        <Label style={{ margin: 10, backgroundColor: PFAlertColor.Success }}>0 Spans with error</Label>
      ) : (
        <Label
          style={{ margin: 10, backgroundColor: filteredErrors === 0 ? PFAlertColor.Warning : PFAlertColor.Danger }}
        >
          {p.filteredSpans && `${filteredErrors} / `}
          {pluralize(errors, 'Span')} with error
        </Label>
      )}
    </>
  );
};
