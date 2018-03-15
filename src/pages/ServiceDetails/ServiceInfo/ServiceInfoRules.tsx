import * as React from 'react';
import ServiceInfoBadge from './ServiceInfoBadge';
import { Rule } from '../../../types/ServiceInfo';
import PfInfoCard from '../../../components/Pf/PfInfoCard';

interface ServiceInfoRulesProps {
  rules?: Rule[];
}

class ServiceInfoRules extends React.Component<ServiceInfoRulesProps> {
  constructor(props: ServiceInfoRulesProps) {
    super(props);
  }

  render() {
    return (
      <PfInfoCard
        iconType="pf"
        iconName="settings"
        title="Istio Route Rules"
        items={(this.props.rules || []).map((rule, i) => (
          <div key={'rule' + i}>
            <div>
              <strong>Name</strong> : {rule.name}
            </div>
            <div>
              <strong>Precendence</strong> : {rule.precedence}
            </div>
            <div>
              <strong>Route</strong>:
              <ul style={{ listStyleType: 'none' }}>
                {(rule.route || []).map((label, u) =>
                  Object.keys(label.labels || new Map()).map((key, n) => (
                    <li key={'rule_' + i + '_label_' + u + '_n_' + n}>
                      <ServiceInfoBadge
                        scale={0.8}
                        style="plastic"
                        color="green"
                        leftText={key}
                        rightText={label.labels ? label.labels[key] : ''}
                      />
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              {!rule.match ? null : (
                <div>
                  <strong>Match</strong>:
                  <textarea
                    className="form-control textarea-resize"
                    readOnly={true}
                    value={JSON.stringify(rule.match, null, 2)}
                  />
                </div>
              )}
            </div>
            <hr />
          </div>
        ))}
      />
    );
  }
}

export default ServiceInfoRules;
