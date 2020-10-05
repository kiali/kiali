import * as React from 'react';
import { style } from 'typestyle';
import { pluralize, Tooltip } from '@patternfly/react-core';

import { JaegerTrace } from '../../types/JaegerInfo';
import { PFAlertColor, PfColors } from 'components/Pf/PfColors';
import { FormattedTraceInfo, shortIDStyle } from './JaegerResults/FormattedTraceInfo';

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
