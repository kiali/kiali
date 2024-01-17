import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { pluralize, Tooltip } from '@patternfly/react-core';

import { JaegerTrace } from '../../types/TracingInfo';
import { PFColors } from 'components/Pf/PfColors';
import { FormattedTraceInfo, shortIDStyle } from './TracingResults/FormattedTraceInfo';

interface Props {
  trace: JaegerTrace;
}

const parentDivStyle = kialiStyle({
  fontSize: 'var(--graph-side-panel--font-size)',
  lineHeight: 1.3
});

const nameStyle = kialiStyle({
  display: 'inline-block',
  maxWidth: 175,
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap'
});

const errorStyle = kialiStyle({
  color: PFColors.Danger
});

const secondaryLeftStyle = kialiStyle({
  color: PFColors.Color200
});

const secondaryRightStyle = kialiStyle({
  color: PFColors.Color200,
  float: 'right'
});

export const TraceListItem: React.FunctionComponent<Props> = props => {
  const formattedTrace = new FormattedTraceInfo(props.trace);
  const nameStyleToUse = formattedTrace.hasErrors() ? nameStyle + ' ' + errorStyle : nameStyle;
  return (
    <Tooltip
      content={
        <>
          {formattedTrace.name()}
          <span className={shortIDStyle}>{formattedTrace.shortID()}</span>
        </>
      }
    >
      <div className={parentDivStyle}>
        <span className={nameStyleToUse}>{formattedTrace.name()}</span>
        {formattedTrace.duration() ? <span className={secondaryRightStyle}>{formattedTrace.duration()}</span> : ''}
        <br />
        <span className={secondaryLeftStyle}>{pluralize(props.trace.spans.length, 'Span')}</span>
        <span className={secondaryRightStyle}>{formattedTrace.fromNow()}</span>
      </div>
    </Tooltip>
  );
};
