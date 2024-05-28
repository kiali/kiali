import * as React from 'react';
import { Form, FormGroup, FormHelperText, HelperText, HelperTextItem, TextInput } from '@patternfly/react-core';
import { K8sGatewaySelectorState } from './K8sGatewaySelector';
import { isValid } from 'utils/Common';
import { isK8sGatewayHostValid } from '../../utils/IstioConfigUtils';

type Props = {
  gateway?: K8sGatewaySelectorState;
  k8sRouteHosts: string[];
  onK8sRouteHostsChange: (valid: boolean, k8sRouteHosts: string[]) => void;
  valid: boolean;
};

export class K8sGRPCRouteHosts extends React.Component<Props> {
  isK8sRouteHostsValid = (k8sRouteHosts: string[]): boolean => {
    // All k8s route hosts must be valid
    return k8sRouteHosts.every(host => {
      return isK8sGatewayHostValid(host);
    });
  };

  render(): React.ReactNode {
    const k8sRouteHosts = this.props.k8sRouteHosts.length > 0 ? this.props.k8sRouteHosts.join(',') : '';
    return (
      <Form isHorizontal={true}>
        <FormGroup label="K8s GRPCRoute Hosts" fieldId="advanced-k8sRouteHosts">
          <TextInput
            value={k8sRouteHosts}
            id="advanced-k8sRouteHosts"
            name="advanced-k8sRouteHosts"
            onChange={(_event, value) => {
              const k8sRouteHosts = value.split(',');
              const isValid = this.isK8sRouteHostsValid(k8sRouteHosts);
              this.props.onK8sRouteHostsChange(isValid, k8sRouteHosts);
            }}
            validated={isValid(this.props.valid)}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                {isValid(this.props.valid)
                  ? 'The route hosts to which traffic is being sent. Enter one or multiple hosts separated by comma.'
                  : "K8s Route hosts should be specified using FQDN format or '*.' format. IPs are not allowed."}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      </Form>
    );
  }
}
