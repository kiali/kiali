import * as React from 'react';
import { ChartArea, ChartGroup, ChartVoronoiContainer } from '@patternfly/react-charts/victory';
import { Card, CardBody, CardHeader, Flex, Icon } from '@patternfly/react-core';
import { AITokenRow, formatCost, formatTokensInMillions, TokenMetric, UsageValueKind } from 'types/Chatbot';
import { PFSpacer } from 'styles/PfSpacer';
import { kialiStyle } from 'styles/StyleUtils';
import { PFFontSize, PFFontWeight } from 'styles/PfTypography';
import { useKialiTranslation } from 'utils/I18nUtils';
import { TokensMillionsValue } from '../TokensMillionsValue';

const costValueStyle = kialiStyle({
  fontSize: 'var(--pf-t--global--font--size--2xl)',
  fontWeight: PFFontWeight.BodyBold,
  lineHeight: 1.2
});

const tokenValueStyle = kialiStyle({
  color: 'var(--pf-t--global--text--color--subtle)',
  fontSize: PFFontSize.small,
  lineHeight: 1.2,
  marginTop: PFSpacer.xs
});

interface AIKPICardProps {
  color: string;
  icon: React.ReactNode;
  id: string;
  isActive: boolean;
  metric: TokenMetric;
  onClick: () => void;
  /** Also render the other metric (cost or tokens) in a smaller size under the primary value. */
  showTokens?: boolean;
  summary: AITokenRow;
  title: string;
  valueKind?: UsageValueKind;
}

export const AIKPICard: React.FC<AIKPICardProps> = ({
  color,
  icon,
  id,
  isActive,
  metric,
  onClick,
  showTokens = false,
  summary,
  title,
  valueKind = 'tokens'
}) => {
  const { t } = useKialiTranslation();
  const formatValue = (value: number): string =>
    valueKind === 'cost' ? formatCost(value, summary.cost?.currency) : formatTokensInMillions(value);
  const pointValue = (point: NonNullable<AITokenRow['timeSeries']>[number]): number =>
    valueKind === 'cost' ? (point.cost?.total ?? 0) : point[metric];
  const cardValue = valueKind === 'cost' ? (summary.cost?.total ?? 0) : summary[metric];
  const seriesName = valueKind === 'cost' ? t('Cost') : t('Tokens');
  const unitLabel = valueKind === 'cost' ? t('Cost') : t('Tokens (M)');
  const data =
    summary.timeSeries?.map(point => ({
      name: seriesName,
      x: new Date(point.timestamp),
      y: pointValue(point)
    })) || [];

  const actionId = `${id}-action`;

  return (
    <Card id={id} isSelectable isSelected={isActive} variant={isActive ? 'default' : 'secondary'}>
      <CardHeader
        selectableActions={{
          selectableActionId: actionId,
          selectableActionAriaLabelledby: id,
          name: `${id}-group`,
          // Checkbox is hidden — the card click triggers selection via the label.
          isHidden: true,
          onChange: (_event, _checked) => onClick()
        }}
      >
        <Flex gap={{ default: 'gapSm' }} alignItems={{ default: 'alignItemsCenter' }}>
          <Icon size="lg" style={{ color }}>
            {icon}
          </Icon>
          <b>
            {title} {unitLabel}
          </b>
        </Flex>
      </CardHeader>
      <CardBody>
        {showTokens ? (
          <>
            <div className={costValueStyle}>
              {valueKind === 'cost' ? formatValue(cardValue) : <TokensMillionsValue fromMillions value={cardValue} />}
            </div>
            <div className={tokenValueStyle}>
              {valueKind === 'cost' ? (
                <TokensMillionsValue fromMillions value={summary[metric]} />
              ) : (
                formatCost(summary.cost?.total ?? 0, summary.cost?.currency)
              )}
            </div>
          </>
        ) : valueKind === 'cost' ? (
          formatValue(cardValue)
        ) : (
          <TokensMillionsValue fromMillions value={cardValue} />
        )}
        <div style={{ height: '100px', width: '100%' }}>
          <ChartGroup
            ariaDesc={`Chart ${title} ${seriesName}`}
            ariaTitle={`Chart ${title} ${seriesName}`}
            maxDomain={{ y: cardValue || 1 }}
            padding={0}
            containerComponent={
              <ChartVoronoiContainer
                labels={({ datum }) => `${datum.name}: ${formatValue(datum.y)}`}
                constrainToVisibleArea
              />
            }
            height={100}
            width={300}
          >
            <ChartArea data={data} style={{ data: { fill: color, stroke: color, fillOpacity: 0.3 } }} />
          </ChartGroup>
        </div>
      </CardBody>
    </Card>
  );
};
