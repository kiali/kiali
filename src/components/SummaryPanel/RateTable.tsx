import * as React from 'react';
import { ErrorRatePieChart } from './ErrorRatePieChart';

type RateTablePropType = {
  title: string;
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
};

export class RateTable extends React.Component<RateTablePropType, {}> {
  render() {
    const errRate: number = this.props.rate3xx + this.props.rate4xx + this.props.rate5xx;
    let percentErr: number = 0;
    if (this.props.rate !== 0) {
      percentErr = errRate / this.props.rate * 100;
    }
    return (
      <div>
        <strong>{this.props.title}</strong>
        <table className="table">
          <thead>
            <tr>
              <th>Total</th>
              <th>3xx</th>
              <th>4xx</th>
              <th>5xx</th>
              <th>% Error</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{this.props.rate.toFixed(2)}</td>
              <td>{this.props.rate3xx.toFixed(2)}</td>
              <td>{this.props.rate4xx.toFixed(2)}</td>
              <td>{this.props.rate5xx.toFixed(2)}</td>
              <td>{errRate.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        <hr />
        <ErrorRatePieChart percentError={percentErr} />
      </div>
    );
  }
}
