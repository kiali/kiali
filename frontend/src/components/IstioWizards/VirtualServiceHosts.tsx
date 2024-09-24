import * as React from 'react';
import { Form, FormGroup, FormHelperText, HelperText, HelperTextItem, TextInput } from '@patternfly/react-core';
import { GatewaySelectorState } from './GatewaySelector';
import { isValid } from 'utils/Common';
import { t } from 'utils/I18nUtils';

type Props = {
  vsHosts: string[];
  gateway?: GatewaySelectorState;
  onVsHostsChange: (valid: boolean, vsHosts: string[]) => void;
};

export class VirtualServiceHosts extends React.Component<Props> {
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
        <FormGroup label={t('VirtualService Hosts')} fieldId="advanced-vshosts">
          <TextInput
            value={vsHosts}
            id="advanced-vshosts"
            name="advanced-vshosts"
            onChange={(_event, value) => {
              const vsHosts = value.split(',');
              const isValid = this.isVirtualServiceHostsValid(vsHosts);
              this.props.onVsHostsChange(isValid, vsHosts);
            }}
          />
          <FormHelperText>
            <HelperText>
              <HelperTextItem>
                {isValid(this.isVirtualServiceHostsValid(this.props.vsHosts))
                  ? t('The destination hosts to which traffic is being sent. Enter one or multiple hosts separated by comma.')
                  : t('VirtualService Host \'*\' wildcard not allowed on mesh gateway.')}
              </HelperTextItem>
            </HelperText>
          </FormHelperText>
        </FormGroup>
      </Form>
    );
  }
}
