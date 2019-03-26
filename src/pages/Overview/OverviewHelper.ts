import { OverviewType } from './OverviewToolbar';
import { FilterSelected } from '../../components/Filters/StatefulFilters';
import { FiltersAndSorts } from './FiltersAndSorts';
import { FAILURE, DEGRADED, HEALTHY } from '../../types/Health';

export const switchType = <T, U, V>(type: OverviewType, caseApp: T, caseService: U, caseWorkload: V): T | U | V => {
  return type === 'app' ? caseApp : type === 'service' ? caseService : caseWorkload;
};

export const summarizeHealthFilters = () => {
  const healthFilters = FilterSelected.getSelected().filter(f => f.category === FiltersAndSorts.healthFilter.title);
  if (healthFilters.length === 0) {
    return {
      noFilter: true,
      showInError: true,
      showInWarning: true,
      showInSuccess: true
    };
  }
  let showInError = false,
    showInWarning = false,
    showInSuccess = false;
  healthFilters.forEach(f => {
    switch (f.value) {
      case FAILURE.name:
        showInError = true;
        break;
      case DEGRADED.name:
        showInWarning = true;
        break;
      case HEALTHY.name:
        showInSuccess = true;
        break;
      default:
    }
  });
  return {
    noFilter: false,
    showInError: showInError,
    showInWarning: showInWarning,
    showInSuccess: showInSuccess
  };
};
