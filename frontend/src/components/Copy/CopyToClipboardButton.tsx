import * as React from 'react';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';

import { KialiIcon } from 'config/KialiIcon';
import { writePlainTextToClipboard } from 'utils/ClipboardUtils';

/** Kiali copy control (not PatternFly's `ClipboardCopyButton`). */
export type CopyToClipboardButtonProps = {
  ariaLabel: string;
  className?: string;
  copiedTooltip: string;
  /** When set, overrides default plain-text copy (e.g. rich markdown for chat). */
  copyText?: (text: string) => Promise<boolean>;
  copyTooltip: string;
  dataTest?: string;
  id: string;
  label?: string;
  labelClassName?: string;
  onClick?: () => void;
  onCopy?: (success: boolean) => void;
  position?: TooltipPosition;
  text: string;
  /** `link`: tooltip + Kiali copy icon + label. Any other `ButtonVariant`: plain button with label only. */
  variant: ButtonVariant;
};

export const CopyToClipboardButton: React.FC<CopyToClipboardButtonProps> = ({
  ariaLabel,
  className,
  copiedTooltip,
  copyText = writePlainTextToClipboard,
  copyTooltip,
  dataTest,
  id,
  label,
  labelClassName,
  onClick,
  onCopy: onCopyProp,
  position = TooltipPosition.top,
  text,
  variant
}) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = (): void => {
    onClick?.();
    void copyText(text).then(success => {
      if (success) {
        setCopied(true);
      }
      onCopyProp?.(success);
    });
  };

  if (variant !== ButtonVariant.link) {
    return (
      <Button
        aria-label={ariaLabel}
        className={className}
        data-test={dataTest}
        id={id}
        onClick={handleCopy}
        variant={variant}
      >
        {label ?? copyTooltip}
      </Button>
    );
  }

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
        data-test={dataTest}
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
};
