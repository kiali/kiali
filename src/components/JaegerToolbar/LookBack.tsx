import * as React from 'react';
import { connect } from 'react-redux';
import { Col, Form, FormGroup, FormControl, FieldLevelHelp } from 'patternfly-react';
import { KialiAppState } from '../../store/Store';
import ToolbarDropdown from '../../components/ToolbarDropdown/ToolbarDropdown';
import { JaegerActions } from '../../actions/JaegerActions';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';

interface LookBackProps {
  fetching: boolean;
  setLookback: (lookback: string) => void;
  lookback: string;
  onChangeCustom: (when: string, dateField: string, timeField: string) => void;
}

export class LookBack extends React.PureComponent<LookBackProps, {}> {
  lookBackOptions = {
    '1h': 'Last Hour',
    '2h': 'Last 2 Hours',
    '3h': 'Last 3 Hours',
    '6h': 'Last 6 Hours',
    '12h': 'Last 12 Hours',
    '24h': 'Last 24 Hours',
    '2d': 'Last 2 Days',
    custom: 'Custom Time Range'
  };

  constructor(props: LookBackProps) {
    super(props);
  }

  componentDidMount() {
    this.props.setLookback(this.props.lookback);
  }

  render() {
    const { lookback, fetching, setLookback, onChangeCustom } = this.props;
    const tz = lookback === 'custom' ? new Date().toTimeString().replace(/^.*?GMT/, 'UTC') : null;

    return (
      <span style={{ marginLeft: '10px' }}>
        <Col componentClass={Form.ControlLabel} style={{ marginRight: '10px' }}>
          Lookback
        </Col>
        <ToolbarDropdown
          id="lookback-selector"
          disabled={fetching}
          options={this.lookBackOptions}
          value={lookback}
          label={this.lookBackOptions[lookback]}
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
                disabled={false}
                onChange={e => onChangeCustom('start', e.target.value, '')}
              />
              <FormControl
                style={{ marginLeft: '10px' }}
                type="time"
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
                disabled={false}
                onChange={e => onChangeCustom('end', e.target.value, '')}
              />
              <FormControl
                style={{ marginLeft: '10px' }}
                type="time"
                disabled={false}
                onChange={e => onChangeCustom('end', '', e.target.value)}
              />
            </FormGroup>
          </Form>
        )}
      </span>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    fetching: state.jaegerState.search.serviceSelected === '',
    lookback: state.jaegerState.search.lookback
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    setLookback: (lookback: string) => {
      dispatch(JaegerActions.setLookback(lookback));
    }
  };
};

const LookBackContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(LookBack);

export default LookBackContainer;
