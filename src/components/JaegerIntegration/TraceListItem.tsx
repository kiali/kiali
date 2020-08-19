import * as React from 'react';
import { style } from 'typestyle';
import { Tooltip } from '@patternfly/react-core';

import { JaegerTrace } from '../../types/JaegerInfo';
import { getFormattedTraceInfo } from './JaegerResults/FormattedTraceInfo';
import { PFAlertColor, PfColors } from 'components/Pf/PfColors';

interface Props {
  trace: JaegerTrace;
}

const parentDivStyle = style({
  fontSize: 'var(--graph-side-panel--font-size)',
  lineHeight: 1.3
});

const nameStyle = style({
  display: 'inline-block',
  maxWidth: 175,
  textOverflow: 'ellipsis',
  overflow: 'hidden',
  whiteSpace: 'nowrap'
});

const errorStyle = style({
  color: PFAlertColor.Danger
});

const secondaryLeftStyle = style({
  color: PfColors.Black600
});

const secondaryRightStyle = style({
  color: PfColors.Black600,
  float: 'right'
});

export const TraceListItem: React.FunctionComponent<Props> = props => {
  const formattedTrace = getFormattedTraceInfo(props.trace);
  const tooltipContent = `${formattedTrace.name} (${props.trace.traceID.slice(0, 7)})`;
  const nameStyleToUse = formattedTrace.errors ? nameStyle + ' ' + errorStyle : nameStyle;
  return (
    <Tooltip content={tooltipContent}>
      <div className={parentDivStyle}>
        <span className={nameStyleToUse}>{formattedTrace.name}</span>
        {formattedTrace.duration ? <span className={secondaryRightStyle}>{formattedTrace.duration}</span> : ''}
        <br />
        <span className={secondaryLeftStyle}>{formattedTrace.spans}</span>
        <span className={secondaryRightStyle}>{formattedTrace.fromNow}</span>
      </div>
    </Tooltip>
  );
};
