import { ChartArea, ChartGroup, ChartVoronoiContainer } from '@patternfly/react-charts/victory';
import { Card, CardBody, CardHeader, Flex, Icon } from '@patternfly/react-core';
import { AITokenRow, TokenMetric } from 'types/Chatbot';

interface AIKPICardProps {
  color: string;
  icon: React.ReactNode;
  id: string;
  isActive: boolean;
  onClick: () => void;
  summary: AITokenRow;
  title: string;
  metric: TokenMetric;
}

export const AIKPICard: React.FC<AIKPICardProps> = ({ color, icon, id, isActive, onClick, summary, title, metric }) => {
  const data =
    summary.timeSeries?.map(point => ({
      name: 'Total tokens',
      x: new Date(point.timestamp),
      y: point[metric]
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
          <b>{title} Tokens</b>
        </Flex>
      </CardHeader>
      <CardBody>
        {summary[metric].toLocaleString()}
        <div style={{ height: '100px', width: '100%' }}>
          <ChartGroup
            ariaDesc={`Chart ${title} tokens`}
            ariaTitle={`Chart ${title} tokens`}
            maxDomain={{ y: summary.totalTokens || 1 }}
            padding={0}
            containerComponent={
              <ChartVoronoiContainer
                labels={({ datum }) => `${datum.name}: ${datum.y.toLocaleString()}`}
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
