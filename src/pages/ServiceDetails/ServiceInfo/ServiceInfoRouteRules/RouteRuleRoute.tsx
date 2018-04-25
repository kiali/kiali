import * as React from 'react';
import { DestinationWeight } from '../../../../types/ServiceInfo';
import Badge from '../../../../components/Badge/Badge';
import { PfColors } from '../../../../components/Pf/PfColors';

interface RouteRuleRouteProps {
  route: DestinationWeight[];
}

class RouteRuleRoute extends React.Component<RouteRuleRouteProps> {
  constructor(props: RouteRuleRouteProps) {
    super(props);
  }

  render() {
    return (
      <div>
        <strong>Route</strong>:
        <ul style={{ listStyleType: 'none' }}>
          {(this.props.route || []).map((label, u) =>
            Object.keys(label.labels || new Map()).map((key, n) => {
              let weight;
              if (label.weight) {
                weight = (
                  <div>
                    <strong>weight</strong>
                    {': ' + label.weight + ' %'}
                  </div>
                );
              }
              return (
                <li key={'route_label_' + u + '_n_' + n}>
                  {weight}
                  <Badge
                    scale={0.8}
                    style="plastic"
                    color={PfColors.Green}
                    leftText={key}
                    rightText={label.labels ? label.labels[key] : ''}
                  />
                </li>
              );
            })
          )}
        </ul>
      </div>
    );
  }
}

export default RouteRuleRoute;
