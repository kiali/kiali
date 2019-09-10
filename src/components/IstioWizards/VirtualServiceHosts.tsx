import * as React from 'react';
import { Form, FormGroup, TextInput } from '@patternfly/react-core';
type Props = {
  vsHosts: string[];
  onVsHostsChange: (valid: boolean, vsHosts: string[]) => void;
};

class VirtualServiceHosts extends React.Component<Props> {
  render() {
    const vsHosts = this.props.vsHosts.length > 0 ? this.props.vsHosts.join(',') : '';
    return (
      <Form isHorizontal={true}>
        <FormGroup
          label="VirtualService Hosts"
          fieldId="advanced-vshosts"
          helperText="The destination hosts to which traffic is being sent. Enter one or multiple hosts separated by comma."
        >
          <TextInput
            value={vsHosts}
            id="advanced-vshosts"
            name="advanced-vshosts"
            onChange={value => this.props.onVsHostsChange(true, value.split(','))}
          />
        </FormGroup>
      </Form>
    );
  }
}

export default VirtualServiceHosts;
