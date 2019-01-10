import * as React from 'react';
import Label from './Label';

interface Props {
  labels: { [key: string]: string };
}

class Labels extends React.Component<Props> {
  labelKeys() {
    return Object.keys(this.props.labels || {});
  }

  hasLabels() {
    return this.labelKeys().length > 0;
  }

  renderLabels() {
    return this.labelKeys().map((key, i) => {
      return (
        <div key={'label_' + i}>
          <Label name={key} value={this.props.labels ? this.props.labels[key] : ''} />
        </div>
      );
    });
  }

  renderEmptyLabels() {
    return <span> No labels </span>;
  }

  render() {
    if (this.hasLabels()) {
      return this.renderLabels();
    } else {
      return this.renderEmptyLabels();
    }
  }
}

export default Labels;
