import * as React from 'react';
import { Form, FormGroup, TextInput } from '@patternfly/react-core';
import { GatewaySelectorState } from './GatewaySelector';
import { isValid } from 'utils/Common';
type Props = {
  vsHosts: string[];
  gateway?: GatewaySelectorState;
  onVsHostsChange: (valid: boolean, vsHosts: string[]) => void;
};

class VirtualServiceHosts extends React.Component<Props> {
  isVirtualServiceHostsValid = (vsHosts: string[]): boolean => {
    if (vsHosts.length === 0) {
      // vsHosts must have a value
      return false;
    }
    const hasWildcard = vsHosts.some(h => h === '*');
    if (this.props.gateway) {
      if (this.props.gateway.addGateway) {
        if (this.props.gateway.addMesh) {
          // Mesh needs a non Wilcard
          return !hasWildcard;
        }
      } else {
        return !hasWildcard;
      }
    } else {
      return !hasWildcard;
    }
    return true;
  };

  render() {
    const vsHosts = this.props.vsHosts.length > 0 ? this.props.vsHosts.join(',') : '';
    return (
      <Form isHorizontal={true}>
        <FormGroup
          label="VirtualService Hosts"
          fieldId="advanced-vshosts"
          validated={isValid(this.isVirtualServiceHostsValid(this.props.vsHosts))}
          helperText="The destination hosts to which traffic is being sent. Enter one or multiple hosts separated by comma."
          helperTextInvalid={"VirtualService Host '*' wildcard not allowed on mesh gateway."}
        >
          <TextInput
            value={vsHosts}
            id="advanced-vshosts"
            name="advanced-vshosts"
            onChange={value => {
              const vsHosts = value.split(',');
              const isValid = this.isVirtualServiceHostsValid(vsHosts);
              this.props.onVsHostsChange(isValid, vsHosts);
            }}
          />
        </FormGroup>
      </Form>
    );
  }
}

export default VirtualServiceHosts;
