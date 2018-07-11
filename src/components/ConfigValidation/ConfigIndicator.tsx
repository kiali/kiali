import * as React from 'react';
import { ObjectValidation } from '../../types/ServiceInfo';
import { PfColors } from '../Pf/PfColors';
import { Icon, OverlayTrigger, Popover, ListGroup, ListGroupItem } from 'patternfly-react';
import { style } from 'typestyle';

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

export const WARNING: Validation = {
  name: 'Warning',
  color: PfColors.Gold100,
  icon: 'warning-triangle-o'
};

export const VALID: Validation = {
  name: 'Valid',
  color: PfColors.Green400,
  icon: 'ok'
};

export const ICON_SIZE = '18px';

const tooltipListStyle = style({
  border: 0,
  padding: '0 0 0 0',
  margin: '0 0 0 0'
});

export class ConfigIndicator extends React.PureComponent<Props, {}> {
  numberOfChecks = (type: string) => (this.props.validation.checks || []).filter(i => i.severity === type).length;

  getTypeMessage = (type: string) => {
    const numberType = this.numberOfChecks(type);
    return numberType > 0
      ? numberType > 1
        ? `${numberType} ${type}s found`
        : `${numberType} ${type} found`
      : undefined;
  };

  getValid() {
    const warnIssues = this.numberOfChecks('warning');
    const errIssues = this.numberOfChecks('error');
    return warnIssues === 0 && errIssues === 0 ? VALID : errIssues > 0 ? NOT_VALID : WARNING;
  }

  tooltipContent() {
    const numChecks = this.props.validation.checks ? this.props.validation.checks.length : 0;

    let issuesMessages: string[] = [];
    if (numChecks === 0) {
      issuesMessages.push('No issues found');
    } else {
      const errMessage = this.getTypeMessage('error');
      if (errMessage) {
        issuesMessages.push(errMessage);
      }
      const warnMessage = this.getTypeMessage('warning');
      if (warnMessage) {
        issuesMessages.push(warnMessage);
      }
    }

    return (
      <Popover id={this.props.id + '-config-validation'} title={this.getValid().name}>
        <ListGroup className={tooltipListStyle}>
          {issuesMessages.map(cat => (
            <ListGroupItem className={tooltipListStyle} key={cat}>
              {cat}
            </ListGroupItem>
          ))}
        </ListGroup>
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
