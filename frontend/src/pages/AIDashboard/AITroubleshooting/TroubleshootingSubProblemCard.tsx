import { Button, Card, CardBody, CardHeader, CardTitle, Label, Tooltip } from '@patternfly/react-core';
import { EyeIcon, EyeSlashIcon, RhUiAiSearchIcon, RhUiAiTroubleshootIcon } from '@patternfly/react-icons';
import * as React from 'react';
import { ChatAIActions } from 'actions/ChatAIActions';
import { GetIstioObjectUrl } from 'components/Link/IstioObjectLink';
import { KialiLink } from 'components/Link/KialiLink';
import { PFBadge, PFBadges } from 'components/Pf/PfBadges';
import { KialiIcon } from 'config/KialiIcon';
import { useAIInteraction } from 'hooks/aiInteraction';
import { useKialiDispatch, useKialiSelector } from 'hooks/redux';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import type {
  TroubleshootingSubProblem,
  TroubleshootingSuggestedAction,
  TroubleshootingValidationCheck
} from 'types/Chatbot';
import { t } from 'utils/I18nUtils';
import {
  cleanSubProblemIssueText,
  isRedundantSubProblemImpact,
  parseTroubleshootingTarget
} from './partitionTroubleshooting';

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
  gap: PFSpacer.sm,
  justifyContent: 'space-between'
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

const checkAskStyle = kialiStyle({
  marginLeft: 'auto'
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
  const { askChat, canSendPrompt, chatAllowed, troubleshoot } = useAIInteraction();
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

  const askIconButton = (prompt: string, ariaLabel: string): React.ReactNode => {
    const canAsk = canSendPrompt(prompt);
    return (
      <Tooltip content={chatAllowed ? t('Ask AI') : t('Chatbot is not allowed for this user')}>
        <span>
          <Button
            aria-label={ariaLabel}
            data-test="ai-troubleshooting-ask-chatbot"
            icon={<RhUiAiSearchIcon />}
            isDisabled={!canAsk}
            onClick={() => askChat(prompt)}
            size="sm"
            variant="plain"
          />
        </span>
      </Tooltip>
    );
  };

  const inlineCheckAskButton = (check: TroubleshootingValidationCheck): React.ReactNode => {
    const prompt = check.suggestedPrompt ?? '';
    const label = check.path
      ? t('Ask AI about {{code}} at {{path}}', { code: check.code, path: check.path })
      : t('Ask AI about {{code}}', { code: check.code });
    return <span className={checkAskStyle}>{askIconButton(prompt, label)}</span>;
  };

  const analyzePrompt = (action: TroubleshootingSuggestedAction): string => action.prompt || suggestedPrompt || '';

  const analyzeAction = (action: TroubleshootingSuggestedAction): React.ReactNode => {
    const prompt = analysisQuery(subProblem, analyzePrompt(action));
    const canOpen = canSendPrompt(prompt);

    return (
      <Tooltip content={canOpen ? t('Try to fix with AI') : t('AI troubleshooting is not available')}>
        <span>
          <Button
            aria-label={t('Try to fix with AI')}
            data-test="ai-troubleshooting-analyze"
            icon={<RhUiAiTroubleshootIcon />}
            isDisabled={!canOpen}
            onClick={() =>
              troubleshoot({
                description: subProblem.target,
                problem: `[${subProblem.id}] ${subProblem.issue}`,
                prompt
              })
            }
            size="sm"
            variant="plain"
          />
        </span>
      </Tooltip>
    );
  };

  const primaryAnalyze = actions.find(action => action.type === 'Analyze' || action.type === 'Question');
  const askChatbotAction =
    checks.length === 0 && suggestedPrompt ? askIconButton(suggestedPrompt, t('Ask AI')) : undefined;

  const badgeType = parsedTarget.badgeKey ? PFBadges[parsedTarget.badgeKey] : undefined;
  const showNamespaceBadge = Boolean(parsedTarget.namespace && parsedTarget.badgeKey !== 'Namespace');
  const showBody = Boolean(showImpact || checks.length > 0);

  return (
    <Card isCompact data-test="ai-troubleshooting-subproblem">
      <CardHeader
        actions={{
          actions: (
            <div className={headerActionsStyle}>
              {askChatbotAction}
              {primaryAnalyze && analyzeAction(primaryAnalyze)}
              {subProblem.istioObject && (
                <KialiLink
                  dataTest="ai-troubleshooting-view-istio-object"
                  to={GetIstioObjectUrl(subProblem.istioObject.name, subProblem.istioObject.namespace, {
                    Group: subProblem.istioObject.group,
                    Kind: subProblem.istioObject.kind,
                    Version: subProblem.istioObject.version
                  })}
                >
                  {t('View IstioObject')}
                </KialiLink>
              )}
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
                  {check.suggestedPrompt && inlineCheckAskButton(check)}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      )}
    </Card>
  );
};
