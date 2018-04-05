import * as React from 'react';
import RuleId from '../../types/RuleId';
import { ToastNotification, ToastNotificationList, Col, Row } from 'patternfly-react';
import IstioRuleInfoDescription from './IstioRuleInfo/IstioRuleInfoDescription';
import * as API from '../../services/Api';
import { RuleAction } from '../../types/IstioRuleInfo';
import IstioRuleInfoAction from './IstioRuleInfo/IstioRuleInfoAction';

type RuleInfoState = {
  name: string;
  match: string;
  actions: RuleAction[];
  error: boolean;
  errorMessage: string;
};

class IstioRuleInfo extends React.Component<RuleId, RuleInfoState> {
  constructor(props: RuleId) {
    super(props);
    this.state = {
      name: '',
      match: '',
      actions: [],
      error: false,
      errorMessage: ''
    };
  }

  componentDidMount() {
    this.fetchIstioRuleDetails(this.props);
  }

  componentWillReceiveProps(nextProps: RuleId) {
    this.fetchIstioRuleDetails(nextProps);
  }

  fetchIstioRuleDetails(props: RuleId) {
    console.log('Fetching info of a service...');
    API.GetIstioRuleDetail(props.namespace, props.rule).then(response => {
      let data = response['data'];
      this.setState({
        name: data.name,
        match: data.match,
        actions: data.actions
      });
    });
  }

  render() {
    let actionList: any = [];
    for (let i = 0; i < this.state.actions.length; i++) {
      actionList.push(
        <Col key={'ruleAction' + i}>
          <IstioRuleInfoAction action={this.state.actions[i]} />
        </Col>
      );
    }

    return (
      <div>
        {this.state.error ? (
          <ToastNotificationList>
            <ToastNotification type="danger">
              <span>
                <strong>Error </strong>
                {this.state.errorMessage}
              </span>
            </ToastNotification>
          </ToastNotificationList>
        ) : null}
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col>
              <IstioRuleInfoDescription name={this.state.name} match={this.state.match} />
            </Col>
            {actionList}
          </Row>
        </div>
      </div>
    );
  }
}

export default IstioRuleInfo;
