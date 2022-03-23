import React from 'react';
import { ObjectCheck, ValidationTypes } from '../../types/IstioObjects';
import Validation from './Validation';
import { highestSeverity } from '../../types/ServiceInfo';
import { Stack, StackItem, Text, TextVariants } from '@patternfly/react-core';
import { style } from 'typestyle';
import { PFColors } from '../Pf/PfColors';

type Props = {
  checks?: ObjectCheck[];
};

const colorStyle = style({ color: PFColors.White });
const titleStyle = style({ color: PFColors.White, fontSize: '1.1rem' });

class ValidationStack extends React.Component<Props> {
  validationList() {
    return (this.props.checks || []).map((check, index) => {
      return (
        <StackItem key={'validation-check-item-' + index} className={colorStyle}>
          <Validation
            key={'validation-check-' + index}
            severity={check.severity}
            message={(check.code ? check.code + ' ' : '') + check.message}
          />
        </StackItem>
      );
    });
  }

  render() {
    const severity = highestSeverity(this.props.checks || []);
    const isValid = severity === ValidationTypes.Correct;
    if (!isValid) {
      return (
        <Stack>
          <StackItem className={titleStyle}>
            <Text component={TextVariants.h1}>Istio validations</Text>
          </StackItem>
          {this.validationList()}
        </Stack>
      );
    } else {
      return null;
    }
  }
}

export default ValidationStack;
