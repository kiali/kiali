import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import ToolbarDropdown from '../../components/ToolbarDropdown/ToolbarDropdown';
import { JaegerActions } from '../../actions/JaegerActions';
import { JaegerThunkActions } from '../../actions/JaegerThunkActions';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';

interface ServiceDropdownProps {
  disabled: boolean;
  activeNamespace: string;
  service: string;
  items: string[];
  refresh: (ns: string) => void;
  setService: (service: string) => void;
}

export class ServiceDropdown extends React.PureComponent<ServiceDropdownProps, {}> {
  constructor(props: ServiceDropdownProps) {
    super(props);
  }

  componentDidMount() {
    if (this.props.activeNamespace) {
      this.props.refresh(this.props.activeNamespace);
    }
  }

  componentDidUpdate(prevProps: ServiceDropdownProps) {
    if (this.props.activeNamespace !== prevProps.activeNamespace && this.props.activeNamespace) {
      this.props.refresh(this.props.activeNamespace);
    }
  }

  handleToggle = (isOpen: boolean) => isOpen && this.props.refresh(this.props.activeNamespace);

  labelServiceDropdown = (items: number) => {
    if (this.props.activeNamespace && this.props.activeNamespace !== 'all') {
      if (items === 0) {
        return 'Choose another namespace with services';
      }
      return 'Choose a service';
    }
    return 'Choose a namespace';
  };

  render() {
    const { disabled } = this.props;

    const items: { [key: string]: string } = this.props.items.reduce((list, item) => {
      list[item] = item;
      return list;
    }, {});

    return (
      <span style={{ marginLeft: '10px' }}>
        <ToolbarDropdown
          id="namespace-selector"
          disabled={disabled || Object.keys(items).length === 0}
          options={items}
          value={''}
          label={this.props.service || this.labelServiceDropdown(Object.keys(items).length)}
          useName={true}
          handleSelect={this.props.setService}
          onToggle={this.handleToggle}
        />
      </span>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    items: state.jaegerState.toolbar.services,
    disabled: state.jaegerState.toolbar.isFetchingService,
    activeNamespace: state.jaegerState.search.namespaceSelected,
    service: state.jaegerState.search.serviceSelected
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    refresh: (ns: string) => {
      dispatch(JaegerThunkActions.asyncFetchServices(ns));
    },
    setService: (service: string) => {
      dispatch(JaegerActions.setService(service));
    }
  };
};

const ServiceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(ServiceDropdown);

export default ServiceDropdownContainer;
