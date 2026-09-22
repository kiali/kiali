import { URLParam } from 'app/History';
import {
  applicationsListColumnsPreset,
  namespacesListColumnsPreset,
  servicesListColumnsPreset,
  workloadsListColumnsPreset
} from '../managedListColumnsPresets';

describe('managedListColumnsPresets', () => {
  it('uses URLParam values that match app/History', () => {
    expect(applicationsListColumnsPreset.columnOrderUrlParam).toBe(URLParam.APPS_COLUMN_ORDER);
    expect(applicationsListColumnsPreset.hiddenColumnsUrlParam).toBe(URLParam.APPS_HIDDEN_COLUMNS);
    expect(servicesListColumnsPreset.columnOrderUrlParam).toBe(URLParam.SERVICES_COLUMN_ORDER);
    expect(servicesListColumnsPreset.hiddenColumnsUrlParam).toBe(URLParam.SERVICES_HIDDEN_COLUMNS);
    expect(workloadsListColumnsPreset.columnOrderUrlParam).toBe(URLParam.WORKLOADS_COLUMN_ORDER);
    expect(workloadsListColumnsPreset.hiddenColumnsUrlParam).toBe(URLParam.WORKLOADS_HIDDEN_COLUMNS);
    expect(namespacesListColumnsPreset.columnOrderUrlParam).toBe(URLParam.NAMESPACES_COLUMN_ORDER);
    expect(namespacesListColumnsPreset.hiddenColumnsUrlParam).toBe(URLParam.NAMESPACES_HIDDEN_COLUMNS);
  });
});
