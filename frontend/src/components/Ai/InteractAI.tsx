import * as React from 'react';
import { Button, ButtonVariant, Tooltip } from '@patternfly/react-core';
import { RhUiAiExperienceIcon, RhUiAiInfoIcon, RhUiAiTroubleshootIcon } from '@patternfly/react-icons';
import { useAIInteraction } from 'hooks/aiInteraction';
import type { TroubleshootInteractionRequest } from 'hooks/aiInteraction';

type InteractAIMode = 'ask' | 'troubleshoot' | '';

type InteractAIProps = {
  /** Extra context prepended for troubleshoot mode. */
  context?: string;
  dataTest?: string;
  /** Extra description used when building the troubleshoot intro. */
  description?: string;
  /** When true the button cannot be clicked. Defaults to !canSendPrompt(prompt). */
  disabled?: boolean;
  /** Overrides the default icon derived from mode. */
  icon?: React.ReactNode;
  /**
   * Interaction mode (also drives the chatbot intro for troubleshoot):
   * - `troubleshoot` → RhUiAiTroubleshootIcon + troubleshoot() with intro from problem/description
   * - `ask` → RhUiAiInfoIcon + askChat()
   * - empty / omitted → RhUiAiExperienceIcon + sendPrompt()
   */
  mode?: InteractAIMode;
  /** Problem title used when building the troubleshoot intro. */
  problem?: string;
  /** Prompt text sent to the chatbot. */
  prompt: string;
  tooltip: string;
  /** When false the button is not rendered. Defaults to chatEnabled. */
  visible?: boolean;
};

const modeIcon = (mode: InteractAIMode | undefined): React.ReactElement => {
  if (mode === 'troubleshoot') {
    return <RhUiAiTroubleshootIcon />;
  }
  if (mode === 'ask') {
    return <RhUiAiInfoIcon />;
  }
  return <RhUiAiExperienceIcon />;
};

export const InteractAI: React.FC<InteractAIProps> = ({
  context,
  dataTest = 'interact-ai',
  description,
  disabled,
  icon,
  mode,
  problem,
  prompt,
  tooltip,
  visible
}) => {
  const { askChat, canSendPrompt, chatEnabled, sendPrompt, troubleshoot } = useAIInteraction();

  const isVisible = visible ?? chatEnabled;
  const isDisabled = disabled ?? !canSendPrompt(prompt);

  if (!isVisible || !prompt.trim()) {
    return null;
  }

  const handleClick = (): void => {
    if (isDisabled || !canSendPrompt(prompt)) {
      return;
    }

    if (mode === 'troubleshoot') {
      const request: TroubleshootInteractionRequest = {
        prompt,
        ...(context ? { context } : {}),
        ...(description ? { description } : {}),
        ...(problem ? { problem } : {})
      };
      troubleshoot(request);
      return;
    }

    if (mode === 'ask') {
      askChat(prompt);
      return;
    }

    sendPrompt(prompt);
  };

  return (
    <Tooltip content={tooltip}>
      <span>
        <Button
          aria-label={tooltip}
          data-test={dataTest}
          icon={icon ?? modeIcon(mode)}
          isDisabled={isDisabled}
          onClick={handleClick}
          variant={ButtonVariant.plain}
        />
      </span>
    </Tooltip>
  );
};
