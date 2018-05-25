import * as React from 'react';
import Badge from '../Badge/Badge';
import { PfColors } from '../../components/Pf/PfColors';

interface DetailObjectProps {
  name: string;
  detail: any;
  labels?: string[];
}

class DetailObject extends React.Component<DetailObjectProps> {
  constructor(props: DetailObjectProps) {
    super(props);
  }

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
    return <Badge scale={0.8} style="plastic" color={PfColors.Green400} leftText={key} rightText={value} />;
  }

  checkLabel(name: string) {
    if (!this.props.labels) {
      return false;
    }
    return this.props.labels.indexOf(name) > -1;
  }

  buildList(name: string, value: any, isLabel: boolean): any {
    let valueType = typeof value;
    if (valueType === 'string' || valueType === 'number' || valueType === 'boolean') {
      return (
        <div>
          {isLabel ? (
            this.label(name, value)
          ) : (
            <span>
              <span className="text-capitalize">[{name}]</span> {value}
            </span>
          )}
        </div>
      );
    }

    let childrenList: any = [];
    let listKey = this.generateKey();
    let checkLabel = this.checkLabel(name);
    if (Array.isArray(value)) {
      value.forEach((v, i) => {
        let vType = typeof v;
        if (vType === 'string' || vType === 'number' || vType === 'boolean') {
          childrenList.push(<li key={listKey + '_i' + i}>{v}</li>);
        } else {
          Object.keys(v).forEach((key, j) => {
            let childList = this.buildList(key, v[key], checkLabel);
            childrenList.push(<li key={listKey + '_i' + i + '_j' + j}>{childList}</li>);
          });
        }
      });
    } else {
      Object.keys(value).forEach((key, k) => {
        let childList = this.buildList(key, value[key], checkLabel);
        childrenList.push(<li key={listKey + '_k' + k}>{childList}</li>);
      });
    }

    return (
      <div>
        <strong className="text-capitalize">{name}</strong>
        <ul style={{ listStyleType: 'none' }}>{childrenList}</ul>
      </div>
    );
  }

  render() {
    let findLabels = typeof this.props.labels !== 'undefined' && this.props.labels.length > 0;

    let objectList = this.buildList(this.props.name, this.props.detail, findLabels);
    return <div>{objectList}</div>;
  }
}

export default DetailObject;
