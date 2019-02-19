import * as React from 'react';
import { connect } from 'react-redux';
import { Col, Form, FormGroup, FormControl, Toolbar } from 'patternfly-react';
import NamespaceDropdownContainer from './NamespaceDropdown';
import ServiceDropdown from './ServiceDropdown';
import LookBack from './LookBack';
import RightToolbar from './RightToolbar';
import TagsControl from './TagsControl';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppState } from '../../store/Store';
import { KialiAppAction } from '../../actions/KialiAppAction';
import { JaegerThunkActions } from '../../actions/JaegerThunkActions';
import { JaegerActions } from '../../actions/JaegerActions';

interface JaegerToolbarProps {
  disableSelector?: boolean;
  tagsValue?: string;
  showGraph: boolean;
  showSummary: boolean;
  showMinimap: boolean;
  disabled: boolean;
  limit: number;
  requestSearchURL: (state: JaegerToolbarState) => void;
  setGraph: (state: boolean) => void;
  setDetails: (state: boolean) => void;
  setMinimap: (state: boolean) => void;
}
interface DateTime {
  date: string;
  time: string;
}

interface JaegerToolbarState {
  tags: string;
  limit: number;
  dateTimes: { [key: string]: DateTime };
  minDuration: string;
  maxDuration: string;
}

export class JaegerToolbar extends React.Component<JaegerToolbarProps, JaegerToolbarState> {
  constructor(props: JaegerToolbarProps) {
    super(props);
    this.state = {
      tags: this.props.tagsValue || '',
      limit: 20,
      minDuration: '',
      maxDuration: '',
      dateTimes: { start: { date: '', time: '' }, end: { date: '', time: '' } }
    };
  }

  onChangeLookBackCustom = (step: string, dateField: string, timeField: string) => {
    const current = this.state.dateTimes;
    dateField ? (current[step].date = dateField) : (current[step].time = timeField);
    this.setState({ dateTimes: current });
  };

  render() {
    const {
      disabled,
      requestSearchURL,
      showGraph,
      showSummary,
      showMinimap,
      setGraph,
      setDetails,
      setMinimap,
      disableSelector,
      limit
    } = this.props;

    return (
      <span>
        <Toolbar>
          {!disableSelector && (
            <span>
              <NamespaceDropdownContainer /> <ServiceDropdown />
            </span>
          )}
          <LookBack onChangeCustom={this.onChangeLookBackCustom} />

          <RightToolbar
            disabled={disabled}
            graph={showGraph}
            minimap={showMinimap}
            summary={showSummary}
            onGraphClick={setGraph}
            onSummaryClick={setDetails}
            onMinimapClick={setMinimap}
            onSubmit={() => requestSearchURL(this.state)}
          />
        </Toolbar>
        <Toolbar>
          <TagsControl onChange={e => this.setState({ tags: e.currentTarget.value })} />
          <FormGroup style={{ display: 'inline-flex' }}>
            <Col componentClass={Form.ControlLabel} style={{ marginTop: '4px' }}>
              Min Duration
            </Col>
            <FormControl
              type="text"
              disabled={disabled}
              placeholder={'e.g. 1.2s, 100ms, 500us'}
              style={{ marginLeft: '10px', width: '200px' }}
              onChange={e => this.setState({ minDuration: e.currentTarget.value })}
            />
          </FormGroup>
          <FormGroup style={{ display: 'inline-flex' }}>
            <Col componentClass={Form.ControlLabel} style={{ marginTop: '4px' }}>
              Max Duration
            </Col>
            <FormControl
              type="text"
              disabled={disabled}
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
              defaultValue={limit}
              style={{ marginLeft: '10px', width: '80px' }}
              onChange={e => this.setState({ limit: e.currentTarget.value })}
            />
          </FormGroup>
        </Toolbar>
      </span>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    limit: state.jaegerState.search.limit,
    showGraph: !state.jaegerState.search.hideGraph,
    showSummary: !state.jaegerState.trace.hideSummary,
    showMinimap: !state.jaegerState.trace.hideMinimap,
    disabled: state.jaegerState.toolbar.isFetchingService || !state.jaegerState.search.serviceSelected
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    requestSearchURL: (state: JaegerToolbarState) => {
      dispatch(
        JaegerThunkActions.setCustomLookback(
          state.dateTimes['start'].date,
          state.dateTimes['start'].time,
          state.dateTimes['end'].date,
          state.dateTimes['end'].time
        )
      );
      dispatch(JaegerActions.setTags(state.tags));
      dispatch(JaegerActions.setLimit(state.limit));
      dispatch(JaegerActions.setDurations(state.minDuration, state.maxDuration));
      dispatch(JaegerThunkActions.getSearchURL());
    },
    setGraph: (state: boolean) => {
      dispatch(JaegerActions.setSearchGraphToHide(state));
    },
    setMinimap: (state: boolean) => {
      dispatch(JaegerActions.setMinimapToShow(state));
    },
    setDetails: (state: boolean) => {
      dispatch(JaegerActions.setDetailsToShow(state));
    }
  };
};

export const JaegerToolbarContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(JaegerToolbar);
