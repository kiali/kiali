import * as React from 'react';
import { Col, ControlLabel, Form, FormControl, FormGroup, HelpBlock } from 'patternfly-react';
type Props = {
  vsHosts: string[];
  onVsHostsChange: (valid: boolean, vsHosts: string[]) => void;
};

class VirtualServiceHosts extends React.Component<Props> {
  render() {
    const vsHosts = this.props.vsHosts.length > 0 ? this.props.vsHosts.join(',') : '';
    return (
      <Form horizontal={true} onSubmit={e => e.preventDefault()}>
        <FormGroup controlId="vsHosts">
          <Col componentClass={ControlLabel} sm={3}>
            VirtualService Hosts
          </Col>
          <Col sm={9}>
            <FormControl
              type="text"
              value={vsHosts}
              onChange={e => this.props.onVsHostsChange(true, e.target.value.split(','))}
            />
            <HelpBlock>
              The destination hosts to which traffic is being sent. Enter one or multiple hosts separated by comma.
            </HelpBlock>
          </Col>
        </FormGroup>
      </Form>
    );
  }
}

export default VirtualServiceHosts;
