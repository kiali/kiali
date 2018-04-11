import * as React from 'react';
import ErrorRatePieChart from './ErrorRatePieChart';

type InOutRateTablePropType = {
  title: string;
  inRate: number;
  inRate3xx: number;
  inRate4xx: number;
  inRate5xx: number;
  outRate: number;
  outRate3xx: number;
  outRate4xx: number;
  outRate5xx: number;
};

export default class InOutRateTable extends React.Component<InOutRateTablePropType, {}> {
  render() {
    const inErrRate: number = this.props.inRate4xx + this.props.inRate5xx;
    const outErrRate: number = this.props.outRate4xx + this.props.outRate5xx;
    const percentInErr = this.props.inRate === 0 ? 0 : inErrRate / this.props.inRate * 100;
    const percentOutErr = this.props.outRate === 0 ? 0 : outErrRate / this.props.outRate * 100;
    return (
      <div>
        <strong>{this.props.title}</strong>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Total</th>
              <th>3xx</th>
              <th>4xx</th>
              <th>5xx</th>
              <th>%Error</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>In</td>
              <td>{this.props.inRate.toFixed(2)}</td>
              <td>{this.props.inRate3xx.toFixed(2)}</td>
              <td>{this.props.inRate4xx.toFixed(2)}</td>
              <td>{this.props.inRate5xx.toFixed(2)}</td>
              <td>{percentInErr.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Out</td>
              <td>{this.props.outRate.toFixed(2)}</td>
              <td>{this.props.outRate3xx.toFixed(2)}</td>
              <td>{this.props.outRate4xx.toFixed(2)}</td>
              <td>{this.props.outRate5xx.toFixed(2)}</td>
              <td>{percentOutErr.toFixed(2)}</td>
            </tr>
            <tr>
              <td>In</td>
              <td colSpan={5}>
                <ErrorRatePieChart percentError={percentInErr} width={150} height={80} />
              </td>
            </tr>
            <tr>
              <td>Out</td>
              <td colSpan={5}>
                <ErrorRatePieChart percentError={percentOutErr} width={150} height={80} />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}
