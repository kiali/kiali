import * as React from 'react';

export const formatTextOrLink = (text: string, urlTruncate?: number): JSX.Element => {
  if (text.startsWith('http://') || text.startsWith('https://')) {
    let truncated = text;
    if (urlTruncate && text.length > urlTruncate) {
      truncated = text.substr(0, urlTruncate / 2) + '...' + text.substr(text.length - urlTruncate / 2);
    }
    return (
      <a href={text} target="_blank" rel="noopener noreferrer">
        {truncated}
      </a>
    );
  }
  return <>{text}</>;
};
