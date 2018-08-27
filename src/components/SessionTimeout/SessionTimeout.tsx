import * as React from 'react';
import { Modal, Button, Icon, Row, Col } from 'patternfly-react';
import { config } from '../../config';
import { UNIT_TIME, MILLISECONDS } from '../../types/Common';

type SessionTimeoutProps = {
  logout: () => void;
  extendSession: () => void;
  show: boolean;
  timeOutCountDown: number;
};

export class SessionTimeout extends React.Component<SessionTimeoutProps, {}> {
  constructor(props: SessionTimeoutProps) {
    super(props);
  }

  render() {
    const extendedTime = config().session.extendedSessionTimeOut
      ? config().session.extendedSessionTimeOut / (MILLISECONDS * UNIT_TIME.MINUTE)
      : 30;
    return (
      <Modal
        className={'message-dialog-pf'}
        show={this.props.show}
        onHide={this.props.logout}
        enforceFocus={true}
        aria-modal={true}
      >
        <Modal.Body>
          <Row style={{ paddingTop: '25px' }}>
            <Col xs={12} sm={1} md={1} lg={1} />
            <Col xs={12} sm={1} md={1} lg={1} style={{ paddingLeft: '10px' }}>
              <Icon name="warning-triangle-o" type="pf" style={{ fontSize: '48px' }} />
            </Col>
            <Col xs={12} sm={10} md={10} lg={10}>
              <p className={'lead'}>
                Your session will timeout in {this.props.timeOutCountDown.toFixed()} seconds.<br />Would you like to
                extend your session for another {extendedTime} minutes?
              </p>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <React.Fragment>
            <Button bsStyle={'default'} onClick={this.props.logout}>
              Log Out
            </Button>
            <Button autoFocus={true} bsStyle={'primary'} onClick={this.props.extendSession}>
              Continue Session
            </Button>
          </React.Fragment>
        </Modal.Footer>
      </Modal>
    );
  }
}
