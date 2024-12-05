import * as React from 'react';
import { Form, FormGroup, FormHelperText, HelperText, HelperTextItem, TextInput } from '@patternfly/react-core';
import { isValid } from 'utils/Common';
import { isK8sGatewayHostValid } from '../../utils/IstioConfigUtils';

type Props = {
  k8sRouteHosts: string[];
  onK8sRouteHostsChange: (valid: boolean, k8sRouteHosts: string[]) => void;
  valid: boolean;
};

export const K8sRouteHosts: React.FC<Props> = (props: Props) => {
  const isK8sRouteHostsValid = (k8sRouteHosts: string[]): boolean => {
    // All k8s route hosts must be valid
    return k8sRouteHosts.every(host => {
      return isK8sGatewayHostValid(host);
    });
  };

  const k8sRouteHosts = props.k8sRouteHosts.length > 0 ? props.k8sRouteHosts.join(',') : '';

  return (
    <Form isHorizontal={true}>
      <FormGroup label="K8s HTTPRoute Hosts" fieldId="advanced-k8sRouteHosts">
        <TextInput
          value={k8sRouteHosts}
          id="advanced-k8sRouteHosts"
          name="advanced-k8sRouteHosts"
          onChange={(_event, value) => {
            const k8sRouteHosts = value.split(',');
            const isValid = isK8sRouteHostsValid(k8sRouteHosts);
            props.onK8sRouteHostsChange(isValid, k8sRouteHosts);
          }}
          validated={isValid(props.valid)}
        />
        <FormHelperText>
          <HelperText>
            <HelperTextItem>
              {isValid(props.valid)
                ? 'The route hosts to which traffic is being sent. Enter one or multiple hosts separated by comma.'
                : "K8s Route hosts should be specified using FQDN format or '*.' format. IPs are not allowed."}
            </HelperTextItem>
          </HelperText>
        </FormHelperText>
      </FormGroup>
    </Form>
  );
};
