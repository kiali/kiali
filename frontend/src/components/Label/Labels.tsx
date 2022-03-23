import * as React from 'react';
import Label from './Label';
import { Button, Tooltip, TooltipPosition } from '@patternfly/react-core';
import { style } from 'typestyle';
import { KialiIcon } from '../../config/KialiIcon';

const SHOW_MORE_TRESHOLD = 2;

interface Props {
  labels?: { [key: string]: string };
  tooltipMessage?: string;
  expanded?: boolean;
}

interface State {
  expanded: boolean;
}

const linkStyle = style({
  float: 'left',
  paddingLeft: '0px',
  marginLeft: '2px',
  fontSize: '0.8rem'
});

const infoStyle = style({
  margin: '0px 4px 2px 10px',
  verticalAlign: '-9px !important'
});

const labelsContainerStyle = style({
  overflow: 'hidden'
});

class Labels extends React.Component<Props, State> {
  constructor(props: Props, state: State) {
    super(props, state);
    this.state = {
      expanded: props.expanded ? props.expanded : false
    };
  }

  labelKeys() {
    return Object.keys(this.props.labels || {});
  }

  hasLabels() {
    return this.labelKeys().length > 0;
  }

  hasManyLabels() {
    return this.labelKeys().length > SHOW_MORE_TRESHOLD;
  }

  showItem(i: number) {
    return this.state.expanded || !this.hasManyLabels() || i < SHOW_MORE_TRESHOLD;
  }

  expandLabels = () => {
    this.setState({ expanded: true });
  };

  renderMoreLabelsLink() {
    if (this.hasManyLabels() && !this.state.expanded) {
      return (
        <Button key="label_more" variant="link" className={linkStyle} onClick={this.expandLabels}>
          More labels...
        </Button>
      );
    }

    return null;
  }

  renderLabels() {
    return this.labelKeys().map((key, i) => {
      return this.showItem(i) ? (
        <div key={'label_' + i}>
          <Label key={'label_' + i} name={key} value={this.props.labels ? this.props.labels[key] : ''} />
        </div>
      ) : undefined;
    });
  }

  renderEmptyLabels() {
    return <span> No labels </span>;
  }

  render() {
    const tooltip = this.props.tooltipMessage ? (
      <Tooltip
        key={`tooltip_missing_sidecar`}
        position={TooltipPosition.auto}
        content={<div style={{ textAlign: 'left' }}>{this.props.tooltipMessage}</div>}
      >
        <KialiIcon.Info className={infoStyle} />
      </Tooltip>
    ) : undefined;
    return (
      <div className={labelsContainerStyle}>
        {this.hasLabels() ? [this.renderLabels(), this.renderMoreLabelsLink()] : this.renderEmptyLabels()}
        {tooltip}
      </div>
    );
  }
}

export default Labels;
