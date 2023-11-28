import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';

type Props = {
  text: string;
  urlTruncate?: number;
  textTruncate?: number;
};

export const TextOrLink: React.FunctionComponent<Props> = props => {
  if (props.text.startsWith('http://') || props.text.startsWith('https://')) {
    let truncated = props.text;
    if (props.urlTruncate && props.text.length > props.urlTruncate) {
      truncated =
        props.text.substr(0, props.urlTruncate / 2) +
        '...' +
        props.text.substr(props.text.length - props.urlTruncate / 2);
    }
    return (
      <a href={props.text} target="_blank" rel="noopener noreferrer">
        {truncated}
      </a>
    );
  }
  let truncated = props.text;
  if (props.textTruncate && props.text.length > props.textTruncate) {
    truncated = props.text.substr(0, props.textTruncate) + '...';
  }
  return (
    <Tooltip content={props.text}>
      <span>{truncated}</span>
    </Tooltip>
  );
};
