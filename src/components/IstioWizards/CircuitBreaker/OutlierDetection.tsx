import * as React from 'react';
import { FormGroup, Switch, TextInput } from '@patternfly/react-core';
import { OutlierDetection as OutlierDetectionProps } from '../../../types/IstioObjects';

type Props = {
  isOutlierDetection: boolean;
  outlierDetection: OutlierDetectionProps;
  onOutlierDetection: (isOutlierDetection: boolean, outlierDetection: OutlierDetectionProps) => void;
};

class OutlierDetection extends React.Component<Props> {
  render() {
    return (
      <>
        <FormGroup label="Add Outlier Detection" fieldId="odSwitch">
          <Switch
            id="odSwitch"
            label={' '}
            labelOff={' '}
            isChecked={this.props.isOutlierDetection}
            onChange={() => this.props.onOutlierDetection(!this.props.isOutlierDetection, this.props.outlierDetection)}
          />
        </FormGroup>
        {this.props.isOutlierDetection && (
          <FormGroup
            label="Consecutive Errors"
            fieldId="consecutiveErrors"
            helperText="Number of errors before a host is ejected from the connection pool."
          >
            <TextInput
              value={this.props.outlierDetection.consecutiveErrors}
              id="consecutiveErrors"
              name="consecutiveErrors"
              onChange={value => {
                let newValue = Number(value || 0);
                newValue = Number.isNaN(newValue) ? 0 : newValue;
                const od = this.props.outlierDetection;
                od.consecutiveErrors = newValue;
                this.props.onOutlierDetection(this.props.isOutlierDetection, od);
              }}
            />
          </FormGroup>
        )}
      </>
    );
  }
}

export default OutlierDetection;
