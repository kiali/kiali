import * as React from 'react';
import { Col, Form, FormGroup, FormControl, FieldLevelHelp } from 'patternfly-react';
import ToolbarDropdown from '../../components/ToolbarDropdown/ToolbarDropdown';
import { config, serverConfig } from '../../config';
import { TracesDate } from './RouteHelper';

interface LookBackProps {
  disabled?: boolean;
  lookback?: number;
  setLookback: (lookback: string) => void;
  onChangeCustom: (when: string, dateField: string, timeField: string) => void;
  dates: TracesDate;
}

export class LookBack extends React.PureComponent<LookBackProps> {
  lookBackOptions = { ...serverConfig.durations, ...{ 0: 'Custom Time Range' } };
  lookbackDefault = config.toolbar.defaultDuration;

  constructor(props: LookBackProps) {
    super(props);
  }

  componentDidMount() {
    this.props.setLookback(String(this.props.lookback));
  }

  render() {
    const { disabled, lookback, setLookback, onChangeCustom, dates } = this.props;
    const tz = lookback === 0 ? new Date().toTimeString().replace(/^.*?GMT/, 'UTC') : null;

    return (
      <>
        <Col componentClass={Form.ControlLabel} style={{ marginRight: '10px', marginLeft: '10px' }}>
          Lookback
        </Col>
        <ToolbarDropdown
          id="lookback-selector"
          disabled={disabled}
          options={this.lookBackOptions}
          value={lookback || this.lookbackDefault}
          label={
            lookback && lookback !== 0
              ? this.lookBackOptions[lookback]
              : lookback === 0
              ? 'Custom Time Range'
              : this.lookBackOptions[this.lookbackDefault]
          }
          useName={false}
          handleSelect={setLookback}
        />
        {tz && (
          <Form style={{ display: 'inline-flex' }} inline={true}>
            <FormGroup>
              <Col componentClass={Form.ControlLabel}>
                Start Time
                <FieldLevelHelp
                  style={{ marginLeft: '10px' }}
                  content={<div>Times are expressed in {tz}</div>}
                  placement={'bottom'}
                />
              </Col>

              <FormControl
                style={{ marginLeft: '10px' }}
                type="date"
                value={dates.start.date}
                disabled={false}
                onChange={e => onChangeCustom('start', e.target.value, '')}
              />
              <FormControl
                style={{ marginLeft: '10px' }}
                type="time"
                value={dates.start.time}
                disabled={false}
                onChange={e => onChangeCustom('start', '', e.target.value)}
              />
            </FormGroup>
            <FormGroup>
              <Col componentClass={Form.ControlLabel}>
                End Time
                <FieldLevelHelp
                  style={{ marginLeft: '10px' }}
                  content={<div>Times are expressed in {tz}</div>}
                  placement={'bottom'}
                />
              </Col>

              <FormControl
                style={{ marginLeft: '10px' }}
                type="date"
                value={dates.end.date}
                disabled={false}
                onChange={e => onChangeCustom('end', e.target.value, '')}
              />
              <FormControl
                style={{ marginLeft: '10px' }}
                type="time"
                value={dates.end.time}
                disabled={false}
                onChange={e => onChangeCustom('end', '', e.target.value)}
              />
            </FormGroup>
          </Form>
        )}
      </>
    );
  }
}

export default LookBack;
