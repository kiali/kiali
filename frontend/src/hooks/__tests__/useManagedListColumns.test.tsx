import * as React from 'react';
import { render } from '@testing-library/react';
import type { Mock } from '@rstest/core';
import { AppsListActions } from '../../actions/AppsListActions';
import { HistoryManager, URLParam } from 'app/History';
import { applicationsListColumnsPreset } from '../managedListColumnsPresets';
import { syncManagedListColumnsFromURL, useManagedListColumns } from '../useManagedListColumns';

const mockDispatch = rstest.fn();

const baseConfig = {
  ...applicationsListColumnsPreset,
  columnOrder: [] as string[],
  dispatch: mockDispatch,
  hiddenColumnIds: [] as string[]
};

type HookSnapshot = ReturnType<typeof useManagedListColumns>;

const HookConsumer: React.FC<{ config: typeof baseConfig; onResult: (result: HookSnapshot) => void }> = ({
  config,
  onResult
}) => {
  const result = useManagedListColumns(config);
  React.useEffect(() => {
    onResult(result);
  }, [onResult, result]);
  return null;
};

describe('syncManagedListColumnsFromURL', () => {
  let getParamSpy: ReturnType<typeof rstest.spyOn>;
  let setParamSpy: ReturnType<typeof rstest.spyOn>;

  beforeEach(() => {
    mockDispatch.mockReset();
    getParamSpy = rstest.spyOn(HistoryManager, 'getParam').mockReturnValue(undefined);
    setParamSpy = rstest.spyOn(HistoryManager, 'setParam').mockImplementation(() => undefined);
  });

  afterEach(() => {
    getParamSpy.mockRestore();
    setParamSpy.mockRestore();
  });

  it('hydrates hidden columns from URL params', () => {
    (HistoryManager.getParam as Mock).mockImplementation((param: URLParam) => {
      if (param === URLParam.APPS_HIDDEN_COLUMNS) {
        return 'health,labels';
      }
      return undefined;
    });

    syncManagedListColumnsFromURL(baseConfig);

    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setHiddenColumns(['health', 'labels']));
  });

  it('ignores fully invalid hidden column URL params when Redux is empty', () => {
    (HistoryManager.getParam as Mock).mockImplementation((param: URLParam) => {
      if (param === URLParam.APPS_HIDDEN_COLUMNS) {
        return 'invalid,unknown';
      }
      return undefined;
    });

    syncManagedListColumnsFromURL(baseConfig);

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('filters invalid hidden column ids from mixed URL params', () => {
    (HistoryManager.getParam as Mock).mockImplementation((param: URLParam) => {
      if (param === URLParam.APPS_HIDDEN_COLUMNS) {
        return 'health,invalid';
      }
      return undefined;
    });

    syncManagedListColumnsFromURL(baseConfig);

    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setHiddenColumns(['health']));
  });

  it('clears hidden columns when URL param has no valid ids but Redux has hidden columns', () => {
    (HistoryManager.getParam as Mock).mockImplementation((param: URLParam) => {
      if (param === URLParam.APPS_HIDDEN_COLUMNS) {
        return 'invalid';
      }
      return undefined;
    });

    syncManagedListColumnsFromURL({
      ...baseConfig,
      hiddenColumnIds: ['health']
    });

    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setHiddenColumns([]));
  });

  it('writes hidden columns to URL when Redux has state but URL param is absent', () => {
    syncManagedListColumnsFromURL({
      ...baseConfig,
      hiddenColumnIds: ['health', 'labels']
    });

    expect(setParamSpy).toHaveBeenCalledWith(URLParam.APPS_HIDDEN_COLUMNS, 'health,labels');
    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('hydrates column order from URL params', () => {
    (HistoryManager.getParam as Mock).mockImplementation((param: URLParam) => {
      if (param === URLParam.APPS_COLUMN_ORDER) {
        return 'health,name,namespace';
      }
      return undefined;
    });

    syncManagedListColumnsFromURL(baseConfig);

    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setColumnOrder(['health', 'name', 'namespace']));
  });
});

describe('useManagedListColumns', () => {
  let getParamSpy: ReturnType<typeof rstest.spyOn>;
  let setParamSpy: ReturnType<typeof rstest.spyOn>;
  let deleteParamSpy: ReturnType<typeof rstest.spyOn>;

  beforeEach(() => {
    mockDispatch.mockReset();
    getParamSpy = rstest.spyOn(HistoryManager, 'getParam').mockReturnValue(undefined);
    setParamSpy = rstest.spyOn(HistoryManager, 'setParam').mockImplementation(() => undefined);
    deleteParamSpy = rstest.spyOn(HistoryManager, 'deleteParam').mockImplementation(() => undefined);
  });

  afterEach(() => {
    getParamSpy.mockRestore();
    setParamSpy.mockRestore();
    deleteParamSpy.mockRestore();
  });

  it('excludes cluster column from modal columns in single-cluster mode', () => {
    let snapshot: HookSnapshot | undefined;

    render(
      <HookConsumer
        config={baseConfig}
        onResult={result => {
          snapshot = result;
        }}
      />
    );

    expect(snapshot?.appliedColumns.some(column => column.key === 'cluster')).toBe(false);
    expect(snapshot?.appliedColumns.some(column => column.key === 'name')).toBe(true);
  });

  it('persists column changes to Redux and URL', () => {
    let snapshot: HookSnapshot | undefined;

    render(
      <HookConsumer
        config={baseConfig}
        onResult={result => {
          snapshot = result;
        }}
      />
    );

    snapshot?.applyColumns([
      { isShown: true, isShownByDefault: true, isUntoggleable: true, key: 'name', title: 'Name' },
      { isShown: false, isShownByDefault: true, key: 'health', title: 'Health' },
      { isShown: true, isShownByDefault: true, key: 'namespace', title: 'Namespace' }
    ]);

    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setColumnOrder(['name', 'health', 'namespace']));
    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setHiddenColumns(['health']));
    expect(setParamSpy).toHaveBeenCalledWith(URLParam.APPS_COLUMN_ORDER, 'name,health,namespace');
    expect(setParamSpy).toHaveBeenCalledWith(URLParam.APPS_HIDDEN_COLUMNS, 'health');
  });

  it('resets columns to default in Redux and URL', () => {
    let snapshot: HookSnapshot | undefined;

    render(
      <HookConsumer
        config={{
          ...baseConfig,
          columnOrder: ['health', 'name'],
          hiddenColumnIds: ['labels']
        }}
        onResult={result => {
          snapshot = result;
        }}
      />
    );

    snapshot?.resetColumnsToDefault();

    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setColumnOrder([]));
    expect(mockDispatch).toHaveBeenCalledWith(AppsListActions.setHiddenColumns([]));
    expect(deleteParamSpy).toHaveBeenCalledWith(URLParam.APPS_COLUMN_ORDER);
    expect(deleteParamSpy).toHaveBeenCalledWith(URLParam.APPS_HIDDEN_COLUMNS);
  });
});
