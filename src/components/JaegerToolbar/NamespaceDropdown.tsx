import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import Namespace from '../../types/Namespace';
import ToolbarDropdown from '../../components/ToolbarDropdown/ToolbarDropdown';
import { JaegerActions } from '../../actions/JaegerActions';
import { ThunkDispatch } from 'redux-thunk';
import { KialiAppAction } from '../../actions/KialiAppAction';
import NamespaceThunkActions from '../../actions/NamespaceThunkActions';
import { JaegerThunkActions } from '../../actions/JaegerThunkActions';

interface NamespaceDropdownProps {
  disabled: boolean;
  namespace: string;
  items: Namespace[];
  refresh: () => void;
  setNamespace: (service: string) => void;
}

export class NamespaceDropdown extends React.PureComponent<NamespaceDropdownProps, {}> {
  constructor(props: NamespaceDropdownProps) {
    super(props);
  }

  componentDidMount() {
    this.props.refresh();
  }

  render() {
    const { disabled, namespace, setNamespace } = this.props;

    const items: { [key: string]: string } = this.props.items.reduce((list, item) => {
      list[item.name] = item.name;
      return list;
    }, {});

    return (
      <ToolbarDropdown
        id="namespace-selector"
        disabled={disabled || Object.keys(items).length === 0}
        options={items}
        value={namespace}
        label={namespace || 'Select a Namespace'}
        useName={true}
        handleSelect={setNamespace}
      />
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    items: state.namespaces.items,
    disabled: state.namespaces.isFetching,
    namespace: state.jaegerState.search.namespaceSelected
  };
};

const mapDispatchToProps = (dispatch: ThunkDispatch<KialiAppState, void, KialiAppAction>) => {
  return {
    refresh: () => {
      dispatch(NamespaceThunkActions.fetchNamespacesIfNeeded());
    },
    setNamespace: (namespace: string) => {
      dispatch(JaegerActions.setNamespace(namespace));
      dispatch(JaegerActions.setService(''));
      dispatch(JaegerThunkActions.asyncFetchServices(namespace));
    }
  };
};

const NamespaceDropdownContainer = connect(
  mapStateToProps,
  mapDispatchToProps
)(NamespaceDropdown);

export default NamespaceDropdownContainer;
