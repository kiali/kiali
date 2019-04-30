import * as React from 'react';
import Label from './Label';
import { style } from 'typestyle';

const SHOW_MORE_TRESHOLD = 3;

interface Props {
  labels?: { [key: string]: string };
}

interface State {
  expanded: boolean;
}

const linkStyle = style({
  float: 'left',
  margin: '7px 2px 2px 3px',
  fontSize: '0.8rem'
});

class Labels extends React.Component<Props, State> {
  constructor(props: Props, state: State) {
    super(props, state);
    this.state = {
      expanded: false
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
        <a className={linkStyle} onClick={this.expandLabels}>
          {' '}
          More labels...
        </a>
      );
    }

    return null;
  }

  renderLabels() {
    return this.labelKeys().map((key, i) => {
      const hideClass = this.showItem(i) ? '' : 'hide';
      return (
        <div key={'label_' + i} className={hideClass}>
          <Label key={'label_' + i} name={key} value={this.props.labels ? this.props.labels[key] : ''} />
        </div>
      );
    });
  }

  renderEmptyLabels() {
    return <span> No labels </span>;
  }

  render() {
    if (this.hasLabels()) {
      return [this.renderLabels(), this.renderMoreLabelsLink()];
    } else {
      return this.renderEmptyLabels();
    }
  }
}

export default Labels;
