import * as React from 'react';
import Label from './Label';
import { Button, ButtonVariant, Tooltip, TooltipPosition } from '@patternfly/react-core';
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
  padding: '0 4px 0 4px',
  fontSize: '0.8rem',
  bottom: '2px'
});

const infoStyle = style({
  margin: '4px 4px 2px 5px'
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
        <Button
          data-test="label_more"
          key="label_more"
          variant={ButtonVariant.link}
          className={linkStyle}
          onClick={this.expandLabels}
        >
          More labels...
        </Button>
      );
    }

    return null;
  }

  renderLabels() {
    return this.labelKeys().map((key, i) => {
      return this.showItem(i) ? (
        <div key={'label_div_' + i} data-test={key + '-label-container'}>
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
