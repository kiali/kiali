import * as React from 'react';
import PfInfoCard from '../../../components/Pf/PfInfoCard';
import { Col, Row } from 'patternfly-react';
import { RuleAction } from '../../../types/IstioRuleInfo';

interface IstioInfoActionProps {
  action: RuleAction;
}

class IstioRuleInfoAction extends React.Component<IstioInfoActionProps> {
  constructor(props: IstioInfoActionProps) {
    super(props);
  }

  render() {
    let handler = this.props.action.handler;
    let instances = this.props.action.instances;
    let handlerCol = (
      <Col xs={12} sm={6} md={6} lg={6}>
        <div className="progress-description">
          <strong>Handler</strong>
          {': ' + handler.name}
          <br />
          <strong>Adapter</strong>
          {': ' + handler.adapter}
        </div>
        <div>
          <textarea
            className="form-control textarea-resize"
            readOnly={true}
            value={JSON.stringify(handler.spec, null, 2)}
          />
        </div>
      </Col>
    );

    let instanceList: any = [];
    for (let i = 0; i < instances.length; i++) {
      instanceList.push(
        <div key={'instance' + i}>
          <div className="progress-description">
            <strong>Instance</strong>
            {': ' + instances[i].name}
            <br />
            <strong>Template</strong>
            {': ' + instances[i].template}
          </div>
          <div>
            <textarea
              className="form-control textarea-resize"
              readOnly={true}
              value={JSON.stringify(instances[i].spec, null, 2)}
            />
          </div>
        </div>
      );
    }

    let instancesCol = (
      <Col xs={12} sm={6} md={6} lg={6}>
        {instanceList}
      </Col>
    );

    return (
      <PfInfoCard
        iconType="pf"
        iconName="blueprint"
        title="Action"
        items={
          <Row>
            {handlerCol}
            {instancesCol}
          </Row>
        }
      />
    );
  }
}

export default IstioRuleInfoAction;
