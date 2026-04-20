import * as React from 'react';

type TextOrLinkProps = {
  text: string;
  urlTruncate?: number;
};

const isSafeHttpUrl = (text: string): boolean => {
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const TextOrLink: React.FC<TextOrLinkProps> = (props: TextOrLinkProps) => {
  if (isSafeHttpUrl(props.text)) {
    let truncated = props.text;

    if (props.urlTruncate && props.text.length > props.urlTruncate) {
      truncated = `${props.text.substring(0, props.urlTruncate / 2)}...${props.text.substring(
        props.text.length - props.urlTruncate / 2
      )}`;
    }

    return (
      <a href={props.text} target="_blank" rel="noopener noreferrer">
        {truncated}
      </a>
    );
  }

  return <>{props.text}</>;
};
