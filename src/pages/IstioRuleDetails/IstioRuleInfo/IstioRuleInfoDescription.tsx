import * as React from 'react';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import { Col, Row } from 'patternfly-react';

interface IstioInfoDescriptionProps {
  name: string;
  match: string;
}

class IstioRuleInfoDescription extends React.Component<IstioInfoDescriptionProps> {
  constructor(props: IstioInfoDescriptionProps) {
    super(props);
  }

  render() {
    return (
      <PfInfoCard
        iconType="pf"
        iconName="migration"
        title={this.props.name}
        items={
          <Row>
            <Col xs={12} sm={8} md={8} lg={8}>
              <div className="progress-description">
                <strong>Match</strong>
              </div>
              <div>{this.props.match}</div>
            </Col>
          </Row>
        }
      />
    );
  }
}

export default IstioRuleInfoDescription;
