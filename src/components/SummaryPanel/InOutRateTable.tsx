import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';
import * as React from 'react';
import { renderInOutRateChartHttp, renderInOutRateChartGrpc } from './RateChart';

type InOutRateTableGrpcPropType = {
  title: string;
  inRate: number;
  inRateGrpcErr: number;
  inRateNR: number;
  outRate: number;
  outRateGrpcErr: number;
  outRateNR: number;
};

export class InOutRateTableGrpc extends React.Component<InOutRateTableGrpcPropType, {}> {
  render() {
    // for the table and graph
    const inErrRate = this.props.inRateGrpcErr + this.props.inRateNR;
    const outErrRate = this.props.outRateGrpcErr + this.props.outRateNR;
    const percentErrIn: number = this.props.inRate === 0 ? 0 : (inErrRate / this.props.inRate) * 100;
    const percentErrOut: number = this.props.outRate === 0 ? 0 : (outErrRate / this.props.outRate) * 100;
    const percentOkIn: number = 100 - percentErrIn;
    const percentOkOut: number = 100 - percentErrOut;

    return (
      <div>
        <div className={summaryTitle}>{this.props.title}</div>
        <table className="table">
          <thead>
            <tr>
              <th />
              <th>Total</th>
              <th>%Success</th>
              <th>%Error</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>In</td>
              <td>{this.props.inRate.toFixed(2)}</td>
              <td>{percentOkIn.toFixed(2)}</td>
              <td>{percentErrIn.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Out</td>
              <td>{this.props.outRate.toFixed(2)}</td>
              <td>{percentOkOut.toFixed(2)}</td>
              <td>{percentErrOut.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        {renderInOutRateChartGrpc(percentOkIn, percentErrIn, percentOkOut, percentErrOut)}
      </div>
    );
  }
}

type InOutRateTableHttpPropType = {
  title: string;
  inRate: number;
  inRate3xx: number;
  inRate4xx: number;
  inRate5xx: number;
  inRateNR: number;
  outRate: number;
  outRate3xx: number;
  outRate4xx: number;
  outRate5xx: number;
  outRateNR: number;
};

export class InOutRateTableHttp extends React.Component<InOutRateTableHttpPropType, {}> {
  render() {
    // for the table
    const inErrRate: number = this.props.inRate4xx + this.props.inRate5xx + this.props.inRateNR;
    const outErrRate: number = this.props.outRate4xx + this.props.outRate5xx + this.props.outRateNR;
    const percentInErr: number = this.props.inRate === 0 ? 0 : (inErrRate / this.props.inRate) * 100;
    const percentOutErr: number = this.props.outRate === 0 ? 0 : (outErrRate / this.props.outRate) * 100;
    const percentInSuccess: number = 100 - percentInErr;
    const percentOutSuccess: number = 100 - percentOutErr;

    // for the graphs
    const rate2xxIn: number =
      this.props.inRate === 0
        ? 0
        : this.props.inRate - this.props.inRate3xx - this.props.inRate4xx - this.props.inRate5xx - this.props.inRateNR;
    const rate2xxOut: number =
      this.props.outRate === 0
        ? 0
        : this.props.outRate -
          this.props.outRate3xx -
          this.props.outRate4xx -
          this.props.outRate5xx -
          this.props.outRateNR;
    const percent2xxIn: number = this.props.inRate === 0 ? 0 : (rate2xxIn / this.props.inRate) * 100;
    const percent3xxIn: number = this.props.inRate === 0 ? 0 : (this.props.inRate3xx / this.props.inRate) * 100;
    const percent4xxIn: number = this.props.inRate === 0 ? 0 : (this.props.inRate4xx / this.props.inRate) * 100;
    const percent5xxIn: number = this.props.inRate === 0 ? 0 : (this.props.inRate5xx / this.props.inRate) * 100;
    const percentNRIn: number = this.props.inRate === 0 ? 0 : (this.props.inRateNR / this.props.inRate) * 100;
    const percent2xxOut: number = this.props.outRate === 0 ? 0 : (rate2xxOut / this.props.outRate) * 100;
    const percent3xxOut: number = this.props.outRate === 0 ? 0 : (this.props.outRate3xx / this.props.outRate) * 100;
    const percent4xxOut: number = this.props.outRate === 0 ? 0 : (this.props.outRate4xx / this.props.outRate) * 100;
    const percent5xxOut: number = this.props.outRate === 0 ? 0 : (this.props.outRate5xx / this.props.outRate) * 100;
    const percentNROut: number = this.props.outRate === 0 ? 0 : (this.props.outRateNR / this.props.outRate) * 100;

    return (
      <div>
        <div className={summaryTitle}>{this.props.title}</div>
        <table className="table" style={{ marginBottom: '10px' }}>
          <thead>
            <tr style={{ backgroundColor: 'white' }}>
              <th />
              <th>Total</th>
              <th>%Success</th>
              <th>%Error</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>In</td>
              <td>{this.props.inRate.toFixed(2)}</td>
              <td>{percentInSuccess.toFixed(2)}</td>
              <td>{percentInErr.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Out</td>
              <td>{this.props.outRate.toFixed(2)}</td>
              <td>{percentOutSuccess.toFixed(2)}</td>
              <td>{percentOutErr.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        {renderInOutRateChartHttp(
          percent2xxIn,
          percent3xxIn,
          percent4xxIn,
          percent5xxIn,
          percentNRIn,
          percent2xxOut,
          percent3xxOut,
          percent4xxOut,
          percent5xxOut,
          percentNROut
        )}
      </div>
    );
  }
}
