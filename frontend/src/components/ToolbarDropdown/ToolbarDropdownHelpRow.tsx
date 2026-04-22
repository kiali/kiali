import { Popover, PopoverPosition } from '@patternfly/react-core';
import * as React from 'react';
import { KialiIcon } from 'config/KialiIcon';
import {
  displayMenuRowContentStyle,
  displayMenuRowIconStyle,
  displayMenuRowStyle,
  displayMenuRowStyleNoHover
} from 'styles/DropdownStyles';
import { helpIconStyle } from 'styles/IconStyle';
import { PFColors } from 'components/Pf/PfColors';
import { useKialiTranslation } from 'utils/I18nUtils';

export const TOOLBAR_DROPDOWN_HELP_HOVER_DELAY_MS = 200;

export const TOOLBAR_DROPDOWN_HELP_POPOVER_WIDTH = '20rem';

export type ToolbarDropdownHelpRowProps = {
  /** When set, help icon stays visible and the row has no hover background (e.g. section titles). */
  alwaysShowHelpIcon?: boolean;
  /** Primary control(s); placed in the flexible left column. */
  children: React.ReactNode;
  /** Rich help body inside the popover; omit for a plain row with no help affordance. */
  helpBody?: React.ReactNode;
  /** Popover header; defaults to translated "Help". */
  helpTitle?: React.ReactNode;
  /** Fixed min/max width for the help popover. */
  popoverWidth?: string;
};

/**
 * Progressive help for PatternFly toolbar dropdown menus: defer the (?) icon until hover (with delay),
 * then click for a Popover. Used by graph Display, graph Traffic, mesh Display, etc.
 */
export const ToolbarDropdownHelpRow: React.FC<ToolbarDropdownHelpRowProps> = ({
  alwaysShowHelpIcon = false,
  children,
  helpBody,
  helpTitle,
  popoverWidth = TOOLBAR_DROPDOWN_HELP_POPOVER_WIDTH
}) => {
  const { t } = useKialiTranslation();
  const [delayedHover, setDelayedHover] = React.useState(false);
  const [popoverOpen, setPopoverOpen] = React.useState(false);
  const hoverTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  const clearHoverTimer = (): void => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleMouseEnter = (): void => {
    if (alwaysShowHelpIcon) {
      return;
    }
    clearHoverTimer();
    hoverTimerRef.current = window.setTimeout(() => {
      setDelayedHover(true);
      hoverTimerRef.current = null;
    }, TOOLBAR_DROPDOWN_HELP_HOVER_DELAY_MS);
  };

  const handleMouseLeave = (): void => {
    if (alwaysShowHelpIcon) {
      return;
    }
    clearHoverTimer();
    if (!popoverOpen) {
      setDelayedHover(false);
    }
  };

  if (!helpBody) {
    return <div className={displayMenuRowStyle}>{children}</div>;
  }

  const showIcon = alwaysShowHelpIcon || delayedHover || popoverOpen;
  const rowClass = alwaysShowHelpIcon ? displayMenuRowStyleNoHover : displayMenuRowStyle;
  const header = helpTitle ?? t('Help');

  return (
    <div className={rowClass} onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      <div className={displayMenuRowContentStyle}>{children}</div>
      <div
        className={displayMenuRowIconStyle}
        style={{
          opacity: showIcon ? 1 : 0,
          pointerEvents: showIcon ? 'auto' : 'none'
        }}
      >
        <Popover
          position={PopoverPosition.right}
          triggerAction="click"
          headerContent={header}
          bodyContent={<div style={{ textAlign: 'left' }}>{helpBody}</div>}
          minWidth={popoverWidth}
          maxWidth={popoverWidth}
          showClose={true}
          onShown={() => setPopoverOpen(true)}
          onHidden={() => setPopoverOpen(false)}
          onHide={() => {
            setDelayedHover(false);
          }}
        >
          <KialiIcon.Help className={helpIconStyle} color={alwaysShowHelpIcon ? PFColors.Black500 : undefined} />
        </Popover>
      </div>
    </div>
  );
};
