import * as React from 'react';
import { ObjectValidation } from '../../types/ServiceInfo';
import { PfColors } from '../Pf/PfColors';
import { Icon, OverlayTrigger, Popover } from 'patternfly-react';

interface Props {
  id: string;
  validation: ObjectValidation;
}

interface Validation {
  name: string;
  color: string;
  icon: string;
}

export const NOT_VALID: Validation = {
  name: 'Not Valid',
  color: PfColors.Red100,
  icon: 'error-circle-o'
};

export const VALID: Validation = {
  name: 'Valid',
  color: PfColors.Green400,
  icon: 'ok'
};

export const ICON_SIZE = '18px';

export class ConfigIndicator extends React.PureComponent<Props, {}> {
  getValid() {
    return this.props.validation.valid ? VALID : NOT_VALID;
  }

  tooltipContent() {
    let numChecks = this.props.validation.checks ? this.props.validation.checks.length : 0;

    return (
      <Popover id={this.props.id + '-config-validation'} title={this.getValid().name}>
        {numChecks === 0 ? 'No issues found' : numChecks === 1 ? '1 issue found' : numChecks + ' issues found'}
      </Popover>
    );
  }

  render() {
    return (
      <span>
        <strong>Config: </strong>{' '}
        <OverlayTrigger
          placement={'right'}
          overlay={this.tooltipContent()}
          trigger={['hover', 'focus']}
          rootClose={false}
        >
          <span style={{ color: this.getValid().color }}>
            <Icon
              type="pf"
              name={this.getValid().icon}
              style={{ fontSize: ICON_SIZE }}
              className="health-icon"
              tabIndex="0"
            />
          </span>
        </OverlayTrigger>
      </span>
    );
  }
}
