import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';
import * as React from 'react';
import { tableStyle } from 'styles/TableStyle';
import { renderRateChartHttp, renderRateChartGrpc } from './RateChart';

type RateTableGrpcPropType = {
  isRequests: boolean;
  rate: number;
  rateGrpcErr: number;
  rateNR: number;
};

type RateTableTcpPropType = {
  rate: number;
};

export class RateTableGrpc extends React.Component<RateTableGrpcPropType, {}> {
  render() {
    // for the table and graph
    const title = `gRPC Traffic (${this.props.isRequests ? 'requests' : 'messages'} per second)`;
    const errRate: number = this.props.rateGrpcErr + this.props.rateNR;
    const percentErr: number = this.props.rate === 0 ? 0 : (errRate / this.props.rate) * 100;
    const percentOK: number = 100 - percentErr;

    return (
      <div>
        <div className={summaryTitle}>{title}</div>
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>{$t('Total')}</th>
              <th>{$t('title3', '%Success')}</th>
              <th>{$t('title4', '%Error')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{this.props.rate.toFixed(2)}</td>
              <td>{this.props.isRequests ? percentOK.toFixed(2) : '-'}</td>
              <td>{this.props.isRequests ? percentErr.toFixed(2) : '-'}</td>
            </tr>
          </tbody>
        </table>
        {this.props.isRequests && renderRateChartGrpc(percentOK, percentErr)}
      </div>
    );
  }
}

type RateTableHttpPropType = {
  title: string;
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
  rateNR: number;
};

export class RateTableHttp extends React.Component<RateTableHttpPropType, {}> {
  render() {
    // for the table
    const errRate: number = this.props.rate4xx + this.props.rate5xx + this.props.rateNR;
    const percentErr: number = this.props.rate === 0 ? 0 : (errRate / this.props.rate) * 100;
    const successErr: number = 100 - percentErr;

    // for the graph
    const rate2xx: number =
      this.props.rate === 0
        ? 0
        : this.props.rate - this.props.rate3xx - this.props.rate4xx - this.props.rate5xx - this.props.rateNR;
    const percent2xx: number = this.props.rate === 0 ? 0 : (rate2xx / this.props.rate) * 100;
    const percent3xx: number = this.props.rate === 0 ? 0 : (this.props.rate3xx / this.props.rate) * 100;
    const percent4xx: number = this.props.rate === 0 ? 0 : (this.props.rate4xx / this.props.rate) * 100;
    const percent5xx: number = this.props.rate === 0 ? 0 : (this.props.rate5xx / this.props.rate) * 100;
    const percentNR: number = this.props.rate === 0 ? 0 : (this.props.rateNR / this.props.rate) * 100;

    return (
      <div>
        <div className={summaryTitle}>{this.props.title}</div>
        <table className={tableStyle} style={{ marginBottom: '0' }}>
          <thead>
            <tr>
              <th>{$t('Total')}</th>
              <th>{$t('title3', '%Success')}</th>
              <th>{$t('title4', '%Error')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{this.props.rate.toFixed(2)}</td>
              <td>{successErr.toFixed(2)}</td>
              <td>{percentErr.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
        {renderRateChartHttp(percent2xx, percent3xx, percent4xx, percent5xx, percentNR)}
      </div>
    );
  }
}

export class RateTableTcp extends React.Component<RateTableTcpPropType, {}> {
  render() {
    return (
      <div>
        <div className={summaryTitle}>{$t('title2', 'TCP Traffic (bytes per second)')}</div>
        <table className={tableStyle}>
          <thead>
            <tr>
              <th>{$t('Total')}</th>
              <th>{$t('title3', '%Success')}</th>
              <th>{$t('title4', '%Error')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{this.props.rate.toFixed(2)}</td>
              <td>{'-'}</td>
              <td>{'-'}</td>
            </tr>
          </tbody>
        </table>
      </div>
    );
  }
}
