import * as React from 'react';
import { CardHeader, Text, TextVariants, Tooltip } from '@patternfly/react-core';
import { JaegerTrace } from '../../../types/JaegerInfo';
import { PfColors } from '../../Pf/PfColors';
import { formatDuration } from './transform';
import { ExternalLinkAltIcon } from '@patternfly/react-icons';

interface JaegerScatterProps {
  trace: JaegerTrace;
  duration?: number;
  onClickLink: string;
}

export class JaegerTraceTitle extends React.Component<JaegerScatterProps> {
  render() {
    const { trace, duration } = this.props;
    const { traceID, traceName } = trace;
    return (
      <CardHeader style={{ backgroundColor: PfColors.Black200, height: '50px' }}>
        <Text component={TextVariants.h3} style={{ margin: 0, position: 'relative' }}>
          {traceName === '' ? '<trace-without-root-span>' : traceName}
          <Tooltip content={<>{traceID}</>}>
            <span style={{ color: PfColors.Black600, paddingLeft: '10px', fontSize: '14px' }}>
              {traceID.slice(0, 7)}
            </span>
          </Tooltip>
          {this.props.onClickLink !== '' && (
            <Tooltip content={<>View Trace in a new tab in the tracing tool</>}>
              <a
                href={this.props.onClickLink}
                style={{ right: '130px', fontSize: '16px', position: 'absolute' }}
                target={'_blank'}
                rel="noopener noreferrer"
              >
                View Trace in Tracing <ExternalLinkAltIcon />
              </a>
            </Tooltip>
          )}
          {duration != null && <span style={{ float: 'right', position: 'relative' }}>{formatDuration(duration)}</span>}
        </Text>
      </CardHeader>
    );
  }
}
