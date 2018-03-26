import PropTypes from 'prop-types';
import Namespace from './Namespace';

export interface GraphFilterProps {
  onLayoutChange: (newLayout: Layout) => void;
  onFilterChange: (newDuration: Duration) => void;
  onNamespaceChange: (newValue: Namespace) => void;
  onError: PropTypes.func;
  activeNamespace: Namespace;
  activeLayout: Layout;
  activeDuration: Duration;
}

export interface GraphFilterState {
  availableNamespaces: { name: string }[];
}

export interface Layout {
  name: string;
}

export interface Duration {
  value: string;
}
