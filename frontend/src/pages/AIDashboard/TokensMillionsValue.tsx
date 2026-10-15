import * as React from 'react';
import { Tooltip } from '@patternfly/react-core';
import { formatTokensInMillions } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

type TokensMillionsValueProps = {
  /** Raw token count, unless `fromMillions` is set. */
  value: number;
  /** True when `value` is already expressed in millions of tokens. */
  fromMillions?: boolean;
};

const exactTokenCount = (value: number, fromMillions: boolean): number =>
  Math.round(fromMillions ? value * 1_000_000 : value);

export const TokensMillionsValue: React.FC<TokensMillionsValueProps> = ({ value, fromMillions = false }) => {
  const millions = fromMillions ? value : value / 1_000_000;
  const exact = exactTokenCount(value, fromMillions).toLocaleString();

  return (
    <Tooltip content={t('{{tokens}} tokens', { tokens: exact })}>
      <span tabIndex={0}>{formatTokensInMillions(millions)}</span>
    </Tooltip>
  );
};
