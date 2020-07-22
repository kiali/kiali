import * as React from 'react';
import { Button, Form, FormGroup, FormSelect, FormSelectOption, TextInput } from '@patternfly/react-core';
import { IstioRule } from '../../types/IstioObjects';
import history from '../../app/History';
import { serverConfig } from '../../config';

export type ThreeScaleCredentialsState = {
  serviceId: string;
  credentials: string;
};

type Props = {
  threeScaleRules: IstioRule[];
  threeScaleCredentials: ThreeScaleCredentialsState;
  onChange: (threeScaleCredentials: ThreeScaleCredentialsState) => void;
};

class ThreeScaleCredentials extends React.Component<Props, ThreeScaleCredentialsState> {
  constructor(props: Props) {
    super(props);
    this.state = {
      serviceId: this.props.threeScaleCredentials.serviceId,
      credentials:
        this.props.threeScaleCredentials.credentials.length > 0
          ? this.props.threeScaleCredentials.credentials
          : this.props.threeScaleRules.length > 0
          ? this.props.threeScaleRules[0].metadata.name
          : ''
    };
  }

  createNewConfig = () => {
    history.push('/extensions/threescale/new?namespaces=' + serverConfig.istioNamespace);
  };

  render() {
    return (
      <Form isHorizontal={true}>
        <FormGroup
          label="3scale Service Id"
          fieldId="threescale-service-id"
          helperText="The 3scale Service Id to link with this workload"
          helperTextInvalid="A workload needs a 3scale Service Id"
          isValid={this.props.threeScaleCredentials.serviceId.length > 0}
        >
          <TextInput
            value={this.state.serviceId}
            id="threescale-service-id"
            name="threescale-service-id"
            onChange={value => {
              this.setState(
                prevState => {
                  return {
                    serviceId: value,
                    credentials: prevState.credentials
                  };
                },
                () => this.props.onChange(this.state)
              );
            }}
            isValid={this.props.threeScaleCredentials.serviceId.length > 0}
          />
        </FormGroup>
        <FormGroup
          label="3scale Credentials"
          fieldId="theescale-credentials"
          helperText={'The 3scale Authorization (Istio Instance+Rule) to link with this Workload'}
          helperTextInvalid={'Create a new 3scale Authorization (Istio Instance+Rule) to link with this Workload'}
          isValid={this.props.threeScaleRules.length > 0}
        >
          <FormSelect
            value={this.state.credentials}
            onChange={value => {
              this.setState(
                prevState => {
                  return {
                    serviceId: prevState.serviceId,
                    credentials: value
                  };
                },
                () => this.props.onChange(this.state)
              );
            }}
            id="threescale-config"
            name="threescale-config"
          >
            {this.props.threeScaleRules.map((option, index) => (
              <FormSelectOption
                isDisabled={false}
                key={index}
                value={option.metadata.name}
                label={option.metadata.name}
              />
            ))}
          </FormSelect>
        </FormGroup>
        <FormGroup fieldId="threescale-create-button">
          <Button id="threescale-create-button" variant="link" onClick={() => this.createNewConfig()}>
            Create New 3scale Config
          </Button>
        </FormGroup>
      </Form>
    );
  }
}

export default ThreeScaleCredentials;
