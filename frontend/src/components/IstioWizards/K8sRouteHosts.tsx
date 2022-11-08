import * as React from 'react';
import { Form, FormGroup, TextInput } from '@patternfly/react-core';
import { K8sGatewaySelectorState } from './K8sGatewaySelector';
import { isValid } from 'utils/Common';
import {isGatewayHostValid} from "../../utils/IstioConfigUtils";
type Props = {
  k8sRouteHosts: string[];
  gateway?: K8sGatewaySelectorState;
  onK8sRouteHostsChange: (valid: boolean, k8sRouteHosts: string[]) => void;
};

class K8sRouteHosts extends React.Component<Props> {
  isK8sRouteHostsValid = (k8sRouteHosts: string[]): boolean => {
    k8sRouteHosts.forEach(host => {
      if (!isGatewayHostValid(host)) {
        return false;
      }
      return true;
    })
    return true;
  };

  render() {
    const k8sRouteHosts = this.props.k8sRouteHosts.length > 0 ? this.props.k8sRouteHosts.join(',') : '';
    return (
      <Form isHorizontal={true}>
        <FormGroup
          label="K8s HTTPRoute Hosts"
          fieldId="advanced-k8sRouteHosts"
          validated={isValid(this.isK8sRouteHostsValid(this.props.k8sRouteHosts))}
          helperText="The route hosts to which traffic is being sent. Enter one or multiple hosts separated by comma."
          helperTextInvalid={"IPs are not allowed. A hostname may be prefixed with a wildcard label (*.)"}
        >
          <TextInput
            value={k8sRouteHosts}
            id="advanced-k8sRouteHosts"
            name="advanced-k8sRouteHosts"
            onChange={value => {
              const k8sRouteHosts = value.split(',');
              const isValid = this.isK8sRouteHostsValid(k8sRouteHosts);
              this.props.onK8sRouteHostsChange(isValid, k8sRouteHosts);
            }}
          />
        </FormGroup>
      </Form>
    );
  }
}

export default K8sRouteHosts;
