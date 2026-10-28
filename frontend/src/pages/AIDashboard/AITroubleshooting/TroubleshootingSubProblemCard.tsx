import { Button, Card, CardBody, CardFooter, CardHeader, CardTitle, Label, Tooltip } from '@patternfly/react-core';
import {
  ExclamationCircleIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  InfoCircleIcon,
  OutlinedCommentsIcon,
  OutlinedQuestionCircleIcon
} from '@patternfly/react-icons';
import * as React from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ChatAIActions } from 'actions/ChatAIActions';
import { isKiosk } from 'components/Kiosk/KioskActions';
import { GetIstioObjectUrl } from 'components/Link/IstioObjectLink';
import { KialiLink } from 'components/Link/KialiLink';
import { PFColors } from 'components/Pf/PfColors';
import { TroubleshootingAnalyze } from 'components/TroubleshootingAnalyze/TroubleshootingAnalyze';
import type { KialiAppState } from 'store/Store';
import { kialiStyle } from 'styles/StyleUtils';
import { PFSpacer } from 'styles/PfSpacer';
import { PFFontWeight } from 'styles/PfTypography';
import type {
  TroubleshootingSubProblem,
  TroubleshootingSuggestedAction,
  TroubleshootingValidationCheck
} from 'types/Chatbot';
import { t } from 'utils/I18nUtils';

const headerStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const headerActionsStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  gap: PFSpacer.sm
});

const footerStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm,
  justifyContent: 'flex-end'
});

const impactRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const checksStyle = kialiStyle({
  display: 'flex',
  flexDirection: 'column',
  gap: PFSpacer.sm,
  marginTop: PFSpacer.sm
});

const checkRowStyle = kialiStyle({
  alignItems: 'center',
  display: 'flex',
  flexWrap: 'wrap',
  gap: PFSpacer.sm
});

const checkCodeStyle = kialiStyle({
  fontWeight: PFFontWeight.BodyBold
});

const dangerIconStyle = kialiStyle({
  color: PFColors.Danger,
  flexShrink: 0
});

const warningIconStyle = kialiStyle({
  color: PFColors.Warning,
  flexShrink: 0
});

const infoIconStyle = kialiStyle({
  color: PFColors.Info,
  flexShrink: 0
});

const adviceIconStyle = kialiStyle({
  alignItems: 'center',
  color: PFColors.Color100,
  cursor: 'help',
  display: 'inline-flex',
  // Same height as the small Analyze button so the icon shares its center line.
  height: '2rem'
});

const severityIcon = (severity?: string): React.ReactNode => {
  switch (severity) {
    case 'critical':
      return <ExclamationCircleIcon aria-label={t('Critical')} className={dangerIconStyle} />;
    case 'warning':
      return <ExclamationTriangleIcon aria-label={t('Warning')} className={warningIconStyle} />;
    default:
      return <InfoCircleIcon aria-label={t('Info')} className={infoIconStyle} />;
  }
};

const actionTooltip = (description: string, command?: string): React.ReactNode => {
  if (!command) {
    return description;
  }
  return (
    <>
      <div>{description}</div>
      <div>{command}</div>
    </>
  );
};

const analysisQuery = (subProblem: TroubleshootingSubProblem, prompt: string): string => {
  const context = `Context: User is troubleshooting ${subProblem.target}. Issue: ${subProblem.issue}. Impact: ${subProblem.impact}.`;
  return `${context}\n\n${prompt}`;
};

export const TroubleshootingSubProblemCard: React.FC<{ subProblem: TroubleshootingSubProblem }> = ({ subProblem }) => {
  const dispatch = useDispatch();
  const actions = subProblem.suggestedActions ?? [];
  const suggestedPrompt = subProblem.suggestedPrompt;
  const impact = subProblem.impact;

  const hidden = useSelector((state: KialiAppState) =>
    state.ai.troubleshooting.hiddenSubProblemIds.includes(subProblem.id)
  );
  // Same gates that mount the chatbot and let this user send messages.
  const chatAllowed = useSelector(
    (state: KialiAppState) =>
      state.ai.enabled && state.ai.chat.enabled && state.ai.chat.allowed && !isKiosk(state.globalState.kiosk)
  );

  const handleToggleHidden = (): void => {
    dispatch(
      hidden
        ? ChatAIActions.showTroubleshootingSubProblem(subProblem.id)
        : ChatAIActions.hideTroubleshootingSubProblem(subProblem.id)
    );
  };

  const hideLabel = hidden ? t('Show problem') : t('Hide problem');
  const checks = subProblem.checks ?? [];

  const askButton = (prompt: string, label: string): React.ReactNode => (
    <Tooltip content={chatAllowed ? prompt : t('Chatbot is not allowed for this user')}>
      <span>
        <Button
          aria-label={label}
          data-test="ai-troubleshooting-ask-chatbot"
          icon={<OutlinedCommentsIcon />}
          isDisabled={!chatAllowed}
          onClick={() => {
            if (!chatAllowed) {
              return;
            }
            dispatch(ChatAIActions.setPendingPrompt(prompt));
          }}
          size="sm"
          variant="secondary"
        >
          {t('Ask chatbot')}
        </Button>
      </span>
    </Tooltip>
  );

  const checkAskLabel = (check: TroubleshootingValidationCheck): string =>
    check.path
      ? t('Ask chatbot about {{code}} at {{path}}', { code: check.code, path: check.path })
      : t('Ask chatbot about {{code}}', { code: check.code });

  const askChatbotAction =
    checks.length === 0 && suggestedPrompt ? askButton(suggestedPrompt, t('Ask chatbot')) : undefined;

  const analyzePrompt = (action: TroubleshootingSuggestedAction): string => action.prompt || suggestedPrompt || '';

  const analyzeAction = (action: TroubleshootingSuggestedAction): React.ReactNode => (
    <TroubleshootingAnalyze
      description={subProblem.target}
      problem={`[${subProblem.id}] ${subProblem.issue}`}
      prompt={analysisQuery(subProblem, analyzePrompt(action))}
      subProblem={subProblem}
    />
  );

  const showBody = Boolean(impact || askChatbotAction || checks.length > 0);

  return (
    <Card isCompact data-test="ai-troubleshooting-subproblem">
      <CardHeader
        actions={{
          actions: (
            <div className={headerActionsStyle}>
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
            {severityIcon(subProblem.severity)}
            <span>{`[${subProblem.id}] ${subProblem.issue}`}</span>
            <Label isCompact>{subProblem.target}</Label>
          </div>
        </CardTitle>
      </CardHeader>
      {showBody && (
        <CardBody>
          {(impact || askChatbotAction) && (
            <div className={impactRowStyle}>
              {impact && <span>{impact}</span>}
              {askChatbotAction}
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
                  <span className={checkCodeStyle}>{`[${check.code}]`}</span>
                  {severityIcon(check.severity)}
                  <span>
                    {check.message}
                    {check.path ? ` (${check.path})` : ''}
                  </span>
                  {check.suggestedPrompt && askButton(check.suggestedPrompt, checkAskLabel(check))}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      )}
      {actions.length > 0 && (
        <CardFooter className={footerStyle}>
          {actions.map(action => {
            const key = `${action.type}-${action.description}-${action.command ?? ''}`;
            if (action.type === 'Question' || action.type === 'Analyze') {
              return <React.Fragment key={key}>{analyzeAction(action)}</React.Fragment>;
            }
            if (action.type === 'Advice') {
              return (
                <Tooltip content={actionTooltip(action.description, action.command)} key={key}>
                  <span
                    aria-label={t('Advice')}
                    className={adviceIconStyle}
                    data-test="ai-troubleshooting-advice"
                    tabIndex={0}
                  >
                    <OutlinedQuestionCircleIcon />
                  </span>
                </Tooltip>
              );
            }
            return (
              <Tooltip content={actionTooltip(action.description, action.command)} key={key}>
                <Button variant="secondary">{action.type}</Button>
              </Tooltip>
            );
          })}
        </CardFooter>
      )}
    </Card>
  );
};
