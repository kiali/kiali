import * as React from 'react';
import ServiceId from '../../types/ServiceId';
import { MetricHistogram, MetricValue } from '../../types/Metrics';
import * as API from '../../services/Api';

type ServiceMetricsState = {
  range: string;
  requestCountIn?: MetricValue;
  requestCountOut?: MetricValue;
  requestSizeIn?: MetricHistogram;
  requestSizeOut?: MetricHistogram;
  requestDurationIn?: MetricHistogram;
  requestDurationOut?: MetricHistogram;
  responseSizeIn?: MetricHistogram;
  responseSizeOut?: MetricHistogram;
  healthyReplicas?: MetricValue;
  totalReplicas?: MetricValue;
};

class ServiceMetrics extends React.Component<ServiceId, ServiceMetricsState> {
  constructor(props: ServiceId) {
    super(props);
    this.state = {
      range: '5m'
    };
    this.onRangeChanged = this.onRangeChanged.bind(this);
    this.fetchMetrics();
  }

  onRangeChanged(event: React.FormEvent<HTMLSelectElement>) {
    this.setState({ range: event.currentTarget.value }, () => {
      this.fetchMetrics();
    });
  }

  render() {
    return (
      <div>
        <h1>
          == SERVICE METRICS ({this.props.namespace} / {this.props.service}) ==
        </h1>
        Range:
        <select value={this.state.range} onChange={this.onRangeChanged}>
          <option value="1m">1 minute</option>
          <option value="5m">5 minutes</option>
          <option value="10m">10 minutes</option>
          <option value="30m">30 minutes</option>
          <option value="1h">1 hour</option>
          <option value="3h">3 hours</option>
          <option value="6h">6 hours</option>
          <option value="12h">12 hours</option>
          <option value="1d">1 day</option>
        </select>
        <div>
          Health: {this.health()}
          <br />
        </div>
        <div>
          <h3>Input</h3>
          <ul>
            <li>Request count rate: {this.scalar(this.state.requestCountIn)}</li>
            <li>Request size: {this.histogram(this.state.requestSizeIn)}</li>
            <li>Request duration: {this.histogram(this.state.requestDurationIn)}</li>
            <li>Response size: {this.histogram(this.state.responseSizeIn)}</li>
          </ul>
        </div>
        <div>
          <h3>Output</h3>
          <ul>
            <li>Request count rate: {this.scalar(this.state.requestCountOut)}</li>
            <li>Request size: {this.histogram(this.state.requestSizeOut)}</li>
            <li>Request duration: {this.histogram(this.state.requestDurationOut)}</li>
            <li>Response size: {this.histogram(this.state.responseSizeOut)}</li>
          </ul>
        </div>
      </div>
    );
  }

  fetchMetrics() {
    console.log('Fetching metrics...');
    API.GetServiceMetrics(this.props.namespace, this.props.service, { range: this.state.range })
      .then(response => {
        console.log(response);
        const metrics: { [key: string]: any } = response['data'];
        this.setState({
          requestCountIn: metrics.hasOwnProperty('request_count_in') ? metrics['request_count_in'] : null,
          requestCountOut: metrics.hasOwnProperty('request_count_out') ? metrics['request_count_out'] : null,
          requestSizeIn: metrics.hasOwnProperty('request_size_in') ? metrics['request_size_in'] : null,
          requestSizeOut: metrics.hasOwnProperty('request_size_out') ? metrics['request_size_out'] : null,
          requestDurationIn: metrics.hasOwnProperty('request_duration_in') ? metrics['request_duration_in'] : null,
          requestDurationOut: metrics.hasOwnProperty('request_duration_out') ? metrics['request_duration_out'] : null,
          responseSizeIn: metrics.hasOwnProperty('response_size_in') ? metrics['response_size_in'] : null,
          responseSizeOut: metrics.hasOwnProperty('response_size_out') ? metrics['response_size_out'] : null,
          healthyReplicas: metrics.hasOwnProperty('healthy_replicas') ? metrics['healthy_replicas'] : null,
          totalReplicas: metrics.hasOwnProperty('total_replicas') ? metrics['total_replicas'] : null
        });
      })
      .catch(error => {
        console.error(error);
      });
  }

  health() {
    if (this.state.healthyReplicas && this.state.totalReplicas) {
      return this.round(100 * this.state.healthyReplicas.Value / this.state.totalReplicas.Value) + ' %';
    }
    return 'n/a';
  }

  scalar(val?: MetricValue) {
    if (val) {
      return this.round(val.Value);
    }
    return 'n/a';
  }

  histogram(hist?: MetricHistogram) {
    if (hist) {
      return `avg: ${this.round(hist.Average)}; med: ${this.round(hist.Median)}; 95th:
        ${this.round(hist.NinetyFiveP)}; 99th: ${this.round(hist.NinetyNineP)}`;
    }
    return 'n/a';
  }

  round(val: number) {
    // 2 decimal digits
    return Math.round(val * 100) / 100;
  }
}

export default ServiceMetrics;
