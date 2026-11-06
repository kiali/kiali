import * as React from 'react';
import { Button, ButtonVariant, ClipboardCopyButton, Tooltip, TooltipPosition } from '@patternfly/react-core';

import { KialiIcon } from 'config/KialiIcon';
import { writePlainTextToClipboard } from 'utils/ClipboardUtils';

export type PlainTextClipboardCopyAppearance = 'icon' | 'link' | 'secondary';

export type PlainTextClipboardCopyButtonProps = {
  appearance?: PlainTextClipboardCopyAppearance;
  ariaLabel: string;
  className?: string;
  copiedTooltip: string;
  copyTooltip: string;
  id: string;
  label?: string;
  labelClassName?: string;
  onClick?: () => void;
  onCopy?: (success: boolean) => void;
  position?: TooltipPosition;
  text: string;
  variant?: 'control' | 'plain';
};

export const PlainTextClipboardCopyButton: React.FC<PlainTextClipboardCopyButtonProps> = ({
  appearance = 'icon',
  ariaLabel,
  className,
  copiedTooltip,
  copyTooltip,
  id,
  label,
  labelClassName,
  onClick,
  onCopy: onCopyProp,
  position = TooltipPosition.top,
  text,
  variant = 'plain'
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (): void => {
    onClick?.();
    void writePlainTextToClipboard(text).then(success => {
      if (success) {
        setCopied(true);
      }
      onCopyProp?.(success);
    });
  };

  if (appearance === 'link') {
    const linkLabel = label ?? ariaLabel;

    return (
      <Tooltip
        content={copied ? copiedTooltip : copyTooltip}
        exitDelay={copied ? 1500 : 600}
        onTooltipHidden={() => setCopied(false)}
        position={position}
      >
        <Button
          aria-label={ariaLabel}
          className={className}
          id={id}
          isInline
          onClick={handleCopy}
          variant={ButtonVariant.link}
        >
          <KialiIcon.Copy />
          <span className={labelClassName}>{linkLabel}</span>
        </Button>
      </Tooltip>
    );
  }

  if (appearance === 'secondary') {
    return (
      <Button
        aria-label={ariaLabel}
        className={className}
        id={id}
        onClick={handleCopy}
        variant={ButtonVariant.secondary}
      >
        {label ?? copyTooltip}
      </Button>
    );
  }

  return (
    <ClipboardCopyButton
      aria-label={ariaLabel}
      className={className}
      exitDelay={copied ? 1500 : 600}
      id={id}
      onClick={handleCopy}
      onTooltipHidden={() => setCopied(false)}
      position={position}
      variant={variant}
    >
      {copied ? copiedTooltip : copyTooltip}
    </ClipboardCopyButton>
  );
};
