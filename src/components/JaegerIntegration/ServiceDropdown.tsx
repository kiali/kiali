import * as React from 'react';
import { connect } from 'react-redux';
import { KialiAppState } from '../../store/Store';
import { FormSelect, FormSelectOption, FormSelectOptionGroup } from '@patternfly/react-core';
import * as Api from '../../services/Api';
import { PromisesRegistry } from '../../utils/CancelablePromises';
import { ServiceOverview } from '../../types/ServiceList';
import { style } from 'typestyle';

interface ServiceDropdownProps {
  disabled?: boolean;
  activeNamespaces: string[];
  service?: string;
  setService: (service: string) => void;
}

interface Service {
  value: string;
  label: string;
  disabled: boolean;
}

interface ServiceGroup {
  groupLabel: string;
  disabled: boolean;
  options: Service[];
}
interface ServiceDropdownState {
  servicesGroups: ServiceGroup[];
}

const serviceDropdown = style({ marginLeft: '-100px' });

export class ServiceDropdown extends React.PureComponent<ServiceDropdownProps, ServiceDropdownState> {
  constructor(props: ServiceDropdownProps) {
    super(props);
    this.state = { servicesGroups: [] };
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
      this.setState({ servicesGroups: [] });
    } else {
      const servicesPromises = namespaces.map(ns => Api.getServices(ns));
      const promises = new PromisesRegistry();
      promises
        .registerAll('services', servicesPromises)
        .then(responses => {
          const serviceList: ServiceGroup[] = [];
          responses.forEach(response => {
            const ns = response.data.namespace.name;
            const serviceGroup: ServiceGroup = { groupLabel: ns, disabled: false, options: [] };

            response.data.services.forEach((service: ServiceOverview) => {
              serviceGroup.options.push({ value: `${service.name}.${ns}`, label: service.name, disabled: false });
            });
            serviceList.push(serviceGroup);
          });
          this.setState({ servicesGroups: serviceList });
        })
        .catch(() => console.log('Error'));
    }
  };

  handleFocus = () => this.refreshServices(this.props.activeNamespaces);

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
    const { servicesGroups } = this.state;

    return (
      <FormSelect
        value={this.props.service}
        isDisabled={disabled || this.props.activeNamespaces.length === 0 || Object.keys(servicesGroups).length === 0}
        onFocus={() => this.handleFocus}
        onChange={this.props.setService}
        aria-label="FormSelect Input"
        className={serviceDropdown}
      >
        <FormSelectOption
          isDisabled={false}
          key={'help_test'}
          value={''}
          label={this.labelServiceDropdown(Object.keys(servicesGroups).length)}
        />
        {servicesGroups.map((group, index) => (
          <FormSelectOptionGroup isDisabled={group.disabled} key={index} label={group.groupLabel}>
            {group.options.map((option, i) => (
              <FormSelectOption isDisabled={option.disabled} key={i} value={option.value} label={option.label} />
            ))}
          </FormSelectOptionGroup>
        ))}
      </FormSelect>
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
