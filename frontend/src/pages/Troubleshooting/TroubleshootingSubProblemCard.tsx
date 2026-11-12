import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Dropdown,
  DropdownItem,
  DropdownList,
  Label,
  MenuToggle,
  Tooltip
} from '@patternfly/react-core';
import type { MenuToggleElement } from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon, RhUiAiTroubleshootIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { ChatAIActions } from 'actions/ChatAIActions';
import { KialiLink } from 'components/Link/KialiLink';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { KialiIcon } from 'config/KialiIcon';
import { useAIInteraction } from 'hooks/aiInteraction';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import type { TroubleshootingSubProblem, TroubleshootingSuggestedAction } from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import {
  cleanSubProblemIssueText,
  isRedundantSubProblemImpact,
  parseTroubleshootingTarget
} from './partitionTroubleshooting';
import { getTroubleshootingResourceLink } from './troubleshootingResourceLink';

const headerStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const headerActionsStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.xs
});

const resourceNameStyle = kialiStyle({
  fontWeight: PFFontWeight.BodyBold
});

const issueSummaryStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  fontWeight: 'normal'
});

const impactRowStyle = kialiStyle({
  alignItems: 'center',
  color: 'var(--pf-t--global--text--color--subtle)',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: PFFontSize.small,
  gap: PFSpacer.sm
});

const checksStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.xs
});

const checkRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const checkInfoStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const checkCodeStyle = kialiStyle({
  fontWeight: PFFontWeight.BodyBold
});

const checkPathStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  fontSize: PFFontSize.small
});

const severityIcon = (severity?: string): React.ReactNode => {
  switch (severity) {
    case 'critical':
      return <KialiIcon.ExclamationCircle status="danger" />;
    case 'warning':
      return <KialiIcon.ExclamationTriangle status="warning" />;
    default:
      return <KialiIcon.Info status="info" />;
  }
};

const analysisQuery = (subProblem: TroubleshootingSubProblem, prompt: string): string => {
  const context = `Context: User is troubleshooting ${subProblem.target}. Issue: ${subProblem.issue}. Impact: ${subProblem.impact}.`;
  return `${context}\n\n${prompt}`;
};

export const TroubleshootingSubProblemCard: React.FC<{ subProblem: TroubleshootingSubProblem }> = ({ subProblem }) => {
  const dispatch = useKialiDispatch();
  const { askChat, canSendPrompt, chatAllowed, chatEnabled, troubleshoot } = useAIInteraction();
  const [isAiMenuOpen, setIsAiMenuOpen] = React.useState(false);
  const actions = subProblem.suggestedActions ?? [];
  const suggestedPrompt = subProblem.suggestedPrompt;
  const impact = subProblem.impact;

  const hidden = useKialiSelector(state => state.ai.troubleshooting.hiddenSubProblemIds.includes(subProblem.id));

  const handleToggleHidden = (): void => {
    dispatch(
      hidden
        ? ChatAIActions.showTroubleshootingSubProblem(subProblem.id)
        : ChatAIActions.hideTroubleshootingSubProblem(subProblem.id)
    );
  };

  const hideLabel = hidden ? t('Show problem') : t('Hide problem');
  const checks = subProblem.checks ?? [];
  const parsedTarget = React.useMemo(() => parseTroubleshootingTarget(subProblem), [subProblem]);
  const cleanIssue = React.useMemo(
    () => cleanSubProblemIssueText(subProblem, parsedTarget),
    [parsedTarget, subProblem]
  );
  const issueWasTruncated = cleanIssue.includes('...') && !subProblem.issue.includes('...');
  const showImpact = Boolean(impact && !isRedundantSubProblemImpact(subProblem));

  const analyzePrompt = (action: TroubleshootingSuggestedAction): string => action.prompt || suggestedPrompt || '';

  const primaryAnalyze =
    actions.find(action => action.type === 'Analyze' || action.type === 'Question') ??
    // Backend may omit Analyze actions when chat is disallowed; still show a disabled Fix control from suggestedPrompt.
    (suggestedPrompt ? { description: t('Fix it with AI'), prompt: suggestedPrompt, type: 'Analyze' } : undefined);

  // Prefer the subproblem prompt; for Istio objects with only check-level prompts, use the first check prompt.
  const askPrompt =
    suggestedPrompt ||
    checks.map(check => check.suggestedPrompt).find((prompt): prompt is string => Boolean(prompt)) ||
    '';

  // Same kebab for all cards (including Istio objects left of "View IstioObject"): Ask AI + Fix it with AI.
  const showAskOption = Boolean(askPrompt);
  const showFixOption = Boolean(primaryAnalyze);
  const showAiMenu = chatEnabled && (showAskOption || showFixOption);

  const canAsk = showAskOption && canSendPrompt(askPrompt);
  const fixPrompt = primaryAnalyze ? analysisQuery(subProblem, analyzePrompt(primaryAnalyze)) : '';
  const canFix = showFixOption && canSendPrompt(fixPrompt);
  const canUseAiMenu = canAsk || canFix;

  const handleAskAi = (): void => {
    if (!canAsk) {
      return;
    }
    setIsAiMenuOpen(false);
    askChat(askPrompt);
  };

  const handleFixWithAi = (): void => {
    if (!canFix || !primaryAnalyze) {
      return;
    }
    setIsAiMenuOpen(false);
    troubleshoot({
      description: subProblem.target,
      problem: `[${subProblem.id}] ${subProblem.issue}`,
      prompt: fixPrompt
    });
  };

  const aiActionsMenu = showAiMenu ? (
    <Dropdown
      isOpen={isAiMenuOpen}
      onOpenChange={setIsAiMenuOpen}
      onSelect={() => setIsAiMenuOpen(false)}
      popperProps={{ position: 'right' }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <Tooltip content={chatAllowed ? t('AI actions') : t('Chatbot is not allowed for this user')}>
          <span>
            <MenuToggle
              aria-label={t('AI actions')}
              data-test="ai-troubleshooting-ai-actions"
              icon={<RhUiAiTroubleshootIcon />}
              isDisabled={!canUseAiMenu}
              isExpanded={isAiMenuOpen}
              onClick={() => setIsAiMenuOpen(prev => !prev)}
              ref={toggleRef}
              variant="plain"
            />
          </span>
        </Tooltip>
      )}
    >
      <DropdownList>
        {showAskOption && (
          <DropdownItem
            data-test="ai-troubleshooting-ask-chatbot"
            isDisabled={!canAsk}
            key="ask-ai"
            onClick={handleAskAi}
          >
            {t('Ask AI')}
          </DropdownItem>
        )}
        {showFixOption && (
          <DropdownItem
            data-test="ai-troubleshooting-analyze"
            isDisabled={!canFix}
            key="fix-with-ai"
            onClick={handleFixWithAi}
          >
            {t('Fix it with AI')}
          </DropdownItem>
        )}
      </DropdownList>
    </Dropdown>
  ) : undefined;

  const badgeType = parsedTarget.badgeKey ? PFBadges[parsedTarget.badgeKey] : undefined;
  const showNamespaceBadge = Boolean(parsedTarget.namespace && parsedTarget.badgeKey !== 'Namespace');
  const showBody = Boolean(showImpact || checks.length > 0);
  const resourceLink = React.useMemo(
    () => getTroubleshootingResourceLink(subProblem, parsedTarget),
    [parsedTarget, subProblem]
  );

  return (
    <Card isCompact data-test="ai-troubleshooting-subproblem">
      <CardHeader
        actions={{
          actions: (
            <div className={headerActionsStyle}>
              {aiActionsMenu}
              <Tooltip content={hideLabel}>
                <Button
                  aria-label={hideLabel}
                  data-test={hidden ? 'ai-troubleshooting-show-subproblem' : 'ai-troubleshooting-hide-subproblem'}
                  icon={hidden ? <EyeIcon /> : <EyeSlashIcon />}
                  onClick={handleToggleHidden}
                  variant="plain"
                />
              </Tooltip>
            </div>
          ),
          hasNoOffset: true
        }}
      >
        <CardTitle>
          <div className={headerStyle}>
            <Tooltip content={subProblem.id}>
              <span>{severityIcon(subProblem.severity)}</span>
            </Tooltip>
            {badgeType && <PFBadge badge={badgeType} size="sm" />}
            <span className={resourceNameStyle}>{parsedTarget.name}</span>
            {showNamespaceBadge && (
              <Label color="grey" data-test="ai-troubleshooting-namespace-badge" isCompact>
                {`ns: ${parsedTarget.namespace}`}
              </Label>
            )}
            {cleanIssue &&
              (issueWasTruncated ? (
                <Tooltip content={subProblem.issue}>
                  <span className={issueSummaryStyle}>{`— ${cleanIssue}`}</span>
                </Tooltip>
              ) : (
                <span className={issueSummaryStyle}>{`— ${cleanIssue}`}</span>
              ))}
            {resourceLink && (
              <>
                <span className={issueSummaryStyle} aria-hidden="true">
                  -
                </span>
                <KialiLink dataTest={resourceLink.dataTest} to={resourceLink.to}>
                  {resourceLink.label}
                </KialiLink>
              </>
            )}
          </div>
        </CardTitle>
      </CardHeader>
      {showBody && (
        <CardBody>
          {showImpact && (
            <div className={impactRowStyle}>
              <span>{impact}</span>
            </div>
          )}
          {checks.length > 0 && (
            <div className={checksStyle}>
              {checks.map(check => (
                <div
                  className={checkRowStyle}
                  data-test="ai-troubleshooting-check"
                  key={`${check.code}-${check.path ?? ''}-${check.message}`}
                >
                  <div className={checkInfoStyle}>
                    {severityIcon(check.severity)}
                    <span className={checkCodeStyle}>{`[${check.code}]`}</span>
                    <span>{check.message}</span>
                    {check.path && <span className={checkPathStyle}>{`(${check.path})`}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
};
