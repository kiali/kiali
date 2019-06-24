import * as React from 'react';
import Label from '../Label/Label';
import { Icon } from 'patternfly-react';
import './DetailObject.css';

interface DetailObjectProps {
  name: string;
  detail: any;
  labels?: string[];
  exclude?: string[];
  validation?: Validation;
}

interface Validation {
  message: string;
  icon: string;
  color: string;
}

class DetailObject extends React.Component<DetailObjectProps> {
  // Pseudo unique ID generator used for keys
  // The recursive nature of buildList() requires uniques list keys.
  // Modified from https://gist.github.com/gordonbrander/2230317
  generateKey() {
    return (
      'key_' +
      Math.random()
        .toString(36)
        .substr(2, 9)
    );
  }

  label(key: string, value: string) {
    return <Label name={key} value={value} />;
  }

  checkLabel(name: string) {
    if (!this.props.labels) {
      return false;
    }
    return this.props.labels.indexOf(name) > -1;
  }

  canDisplay(name: string) {
    return this.props.exclude == null || !this.props.exclude.includes(name);
  }

  // buildList returns a recursive list of all items within value. It shows a validation
  // only for the first iteration (when depth is 0)
  buildList(name: string, value: any, isLabel: boolean, depth: number): any {
    if (!this.canDisplay(name)) {
      return '';
    }

    const valueType = typeof value;
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
      return (
        <div className="label-collection">
          {isLabel ? (
            this.label(name, value)
          ) : (
            <span>
              <span className="text-capitalize">{name ? `[${name}]` : name}</span> {value.toString()}
            </span>
          )}
        </div>
      );
    }

    const childrenList: any[] = [];
    const listKey = this.generateKey();
    const checkLabel = this.checkLabel(name);
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        const vType = typeof v;
        if (vType === 'string' || vType === 'number' || vType === 'boolean') {
          childrenList.push(<li key={listKey + '_i' + i}>{v}</li>);
        } else {
          Object.keys(v).forEach((key, j) => {
            const childList = this.buildList(key, v[key], checkLabel, depth + 1);
            childrenList.push(<li key={listKey + '_i' + i + '_j' + j}>{childList}</li>);
          });
        }
      });
    } else {
      Object.keys(value || {}).forEach((key, k) => {
        const childList = this.buildList(key, value[key], checkLabel, depth + 1);
        childrenList.push(<li key={listKey + '_k' + k}>{childList}</li>);
      });
    }

    return childrenList.length > 0 ? (
      <div>
        <strong className="text-capitalize">{name}</strong>
        {depth === 0 && !!this.props.validation && this.props.validation.message ? (
          <div>
            <p style={{ color: this.props.validation.color }}>
              <Icon type="pf" name={this.props.validation.icon} /> {this.props.validation.message}
            </p>
          </div>
        ) : (
          undefined
        )}
        <ul className={'details'}>{childrenList}</ul>
      </div>
    ) : (
      ''
    );
  }

  render() {
    const findLabels = typeof this.props.labels !== 'undefined' && this.props.labels.length > 0;

    const objectList = this.buildList(this.props.name, this.props.detail, findLabels, 0);
    return <div>{objectList}</div>;
  }
}

export default DetailObject;
