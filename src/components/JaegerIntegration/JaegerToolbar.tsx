import * as React from 'react';
import { Col, Form, FormControl, FormGroup, Grid, Row, Toolbar } from 'patternfly-react';
import ServiceDropdown from './ServiceDropdown';
import LookBack from './LookBack';
import RightToolbar from './RightToolbar';
import TagsControl from './TagsControl';
import {
  getUnixTimeStampInMSFromForm,
  logfmtTagsConv,
  getFormFromUnixTimeStamp,
  JaegerSearchOptions,
  TracesDate
} from './RouteHelper';
import { HistoryManager, URLParam } from '../../app/History';

interface JaegerToolbarProps {
  disableSelectorNs?: boolean;
  tagsValue?: string;
  limit?: number;
  serviceSelected?: string;
  updateURL: (url: JaegerSearchOptions) => void;
  disabled?: boolean;
}

interface JaegerToolbarState {
  tags: string;
  limit: number;
  lookback: string;
  dateTimes: TracesDate;
  minDuration: string;
  maxDuration: string;
  serviceSelected: string;
}

export class JaegerToolbar extends React.Component<JaegerToolbarProps, JaegerToolbarState> {
  defaultLookback = 3600;

  constructor(props: JaegerToolbarProps) {
    super(props);
    const start = HistoryManager.getParam(URLParam.JAEGER_START_TIME);
    const end = HistoryManager.getParam(URLParam.JAEGER_END_TIME);
    const lookback = HistoryManager.getParam(URLParam.JAEGER_LOOKBACK);
    const startDateTime =
      start && lookback === 'custom'
        ? getFormFromUnixTimeStamp(Number(start) / 1000)
        : getFormFromUnixTimeStamp(0, -60 * 60 * 1000);
    const endDateTime =
      end && lookback === 'custom' ? getFormFromUnixTimeStamp(Number(end) / 1000) : getFormFromUnixTimeStamp(0);

    this.state = {
      tags: logfmtTagsConv(HistoryManager.getParam(URLParam.JAEGER_TAGS)) || this.props.tagsValue || '',
      limit: Number(HistoryManager.getParam(URLParam.JAEGER_LIMIT_TRACES) || '20'),
      minDuration: HistoryManager.getParam(URLParam.JAEGER_MIN_DURATION) || '',
      maxDuration: HistoryManager.getParam(URLParam.JAEGER_MAX_DURATION) || '',
      lookback: HistoryManager.getParam(URLParam.JAEGER_LOOKBACK) || String(this.defaultLookback),
      serviceSelected: HistoryManager.getParam(URLParam.JAEGER_SERVICE_SELECTOR) || this.props.serviceSelected || '',
      dateTimes: { start: startDateTime, end: endDateTime }
    };
    if (HistoryManager.getParam(URLParam.JAEGER_SERVICE_SELECTOR) || this.props.serviceSelected) {
      this.onRequestTraces();
    }
  }

  onChangeLookBackCustom = (step: string, dateField: string, timeField: string) => {
    const current = this.state.dateTimes;
    if (dateField) {
      current[step].date = dateField;
    }
    if (timeField) {
      current[step].time = timeField;
    }
    this.setState({ dateTimes: current });
  };

  onRequestTraces = () => {
    const toTimestamp = getUnixTimeStampInMSFromForm(
      this.state.dateTimes.start.date,
      this.state.dateTimes.start.time,
      this.state.dateTimes.end.date,
      this.state.dateTimes.end.time
    );
    const options: JaegerSearchOptions = {
      start: toTimestamp.start,
      end: toTimestamp.end,
      serviceSelected: this.state.serviceSelected,
      limit: this.state.limit,
      lookback: this.state.lookback,
      minDuration: this.state.minDuration,
      maxDuration: this.state.maxDuration,
      tags: this.state.tags
    };

    this.props.updateURL(options);
  };

  render() {
    const { disabled, disableSelectorNs } = this.props;

    return (
      <Toolbar>
        <Grid fluid={true}>
          <Col md={8}>
            <Row>
              {!disableSelectorNs && (
                <ServiceDropdown
                  service={this.state.serviceSelected}
                  setService={(service: string) => this.setState({ serviceSelected: service })}
                />
              )}
              <LookBack
                onChangeCustom={this.onChangeLookBackCustom}
                lookback={this.state.lookback !== 'custom' ? Number(this.state.lookback) : 0}
                setLookback={(lookback: string) => this.setState({ lookback: lookback })}
                dates={this.state.dateTimes}
              />
            </Row>
            <Row style={{ marginTop: '10px' }}>
              <TagsControl tags={this.state.tags} onChange={e => this.setState({ tags: e.currentTarget.value })} />
              <FormGroup style={{ display: 'inline-flex' }}>
                <Col componentClass={Form.ControlLabel} style={{ marginTop: '4px' }}>
                  Min Span Duration
                </Col>
                <FormControl
                  type="text"
                  disabled={disabled}
                  value={this.state.minDuration}
                  placeholder={'e.g. 1.2s, 100ms, 500us'}
                  style={{ marginLeft: '10px', width: '200px' }}
                  onChange={e => this.setState({ minDuration: e.currentTarget.value })}
                />
              </FormGroup>
              <FormGroup style={{ display: 'inline-flex' }}>
                <Col componentClass={Form.ControlLabel} style={{ marginTop: '4px' }}>
                  Max Span Duration
                </Col>
                <FormControl
                  type="text"
                  disabled={disabled}
                  value={this.state.maxDuration}
                  placeholder={'e.g. 1.1s'}
                  style={{ marginLeft: '10px', width: '200px' }}
                  onChange={e => this.setState({ maxDuration: e.currentTarget.value })}
                />
              </FormGroup>
              <FormGroup style={{ display: 'inline-flex' }}>
                <Col componentClass={Form.ControlLabel} style={{ marginTop: '4px' }}>
                  Limit Results
                </Col>
                <FormControl
                  type="number"
                  disabled={disabled}
                  value={this.state.limit}
                  defaultValue={this.state.limit}
                  style={{ marginLeft: '10px', width: '80px' }}
                  onChange={e => this.setState({ limit: e.currentTarget.value })}
                />
              </FormGroup>
            </Row>
          </Col>
          <Col md={4}>
            <Row>
              <RightToolbar disabled={this.state.serviceSelected === ''} onSubmit={this.onRequestTraces} />
            </Row>
          </Col>
        </Grid>
      </Toolbar>
    );
  }
}
