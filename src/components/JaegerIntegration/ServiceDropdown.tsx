import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import { Col, Form } from 'patternfly-react';
import ToolbarDropdown from '../../components/ToolbarDropdown/ToolbarDropdown';
import * as Api from '../../services/Api';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { ServiceOverview } from '../../types/ServiceList';

interface ServiceDropdownProps {
  disabled?: boolean;
  activeNamespaces: string[];
  service?: string;
  setService: (service: string) => void;
}

interface ServiceDropdownState {
  servicesOfNs: string[];
}
export class ServiceDropdown extends React.PureComponent<ServiceDropdownProps, ServiceDropdownState> {
  constructor(props: ServiceDropdownProps) {
    super(props);
    this.state = { servicesOfNs: [] };
    if (this.props.activeNamespaces.length > 0) {
      this.refreshServices(this.props.activeNamespaces);
    }
  }

  componentDidUpdate(prevProps: ServiceDropdownProps) {
    if (prevProps.activeNamespaces.sort().join(',') !== this.props.activeNamespaces.sort().join(',')) {
      this.refreshServices(this.props.activeNamespaces);
    }
  }

  refreshServices = (namespaces: string[]) => {
    if (namespaces.length === 0) {
      this.setState({ servicesOfNs: [] });
    } else {
      const servicesPromises = namespaces.map(ns => Api.getServices(ns));
      const promises = new PromisesRegistry();
      promises
        .registerAll('services', servicesPromises)
        .then(responses => {
          const serviceListItems: string[] = [];
          responses.forEach(response => {
            const ns = response.data.namespace.name;
            response.data.services.forEach((service: ServiceOverview) => {
              serviceListItems.push(`${service.name}.${ns}`);
            });
          });
          this.setState({ servicesOfNs: serviceListItems });
        })
        .catch(() => console.log('Error'));
    }
  };

  handleToggle = (isOpen: boolean) => isOpen && this.refreshServices(this.props.activeNamespaces);

  labelServiceDropdown = (items: number) => {
    if (this.props.activeNamespaces.length > 0) {
      if (items === 0) {
        return 'Select another namespace with services';
      }
      return 'Select a service';
    }
    return 'Select a namespace';
  };

  render() {
    const { disabled } = this.props;
    const { servicesOfNs } = this.state;
    const items: { [key: string]: string } = servicesOfNs.reduce((list, item) => {
      list[item] = item;
      return list;
    }, {});

    return (
      <>
        <Col componentClass={Form.ControlLabel} style={{ marginRight: '10px' }}>
          Service :
        </Col>
        <ToolbarDropdown
          id="namespace-selector"
          disabled={disabled || this.props.activeNamespaces.length === 0 || Object.keys(items).length === 0}
          options={items}
          value={''}
          label={this.props.service || this.labelServiceDropdown(Object.keys(items).length)}
          useName={true}
          handleSelect={this.props.setService}
          onToggle={this.handleToggle}
        />
      </>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    activeNamespaces: state.namespaces.activeNamespaces.map(ns => ns.name)
  };
};

const ServiceDropdownContainer = connect(mapStateToProps)(ServiceDropdown);

export default ServiceDropdownContainer;
