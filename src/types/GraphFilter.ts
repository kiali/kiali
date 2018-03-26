import PropTypes from 'prop-types';
import Namespace from './Namespace';

export interface GraphFilterProps {
  onLayoutChange: (newLayout: Layout) => void;
  onFilterChange: (newInterval: Interval) => void;
  onNamespaceChange: (newValue: Namespace) => void;
  onError: PropTypes.func;
  activeNamespace: Namespace;
  activeLayout: Layout;
  activeInterval: Interval;
}

export interface GraphFilterState {
  availableNamespaces: { name: string }[];
}

export interface Layout {
  name: string;
}

export interface Interval {
  value: string;
}
