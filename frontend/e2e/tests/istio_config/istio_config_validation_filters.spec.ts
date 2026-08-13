import { test } from '../../fixtures/kialiFixtures';

const smokeCoreCaching = { tag: ['@smoke', '@core-caching'] as const };

test.describe('Istio Config validation filters', () => {
  test.beforeEach(async ({ istioConfigPage }) => {
    await istioConfigPage.openWithNamespace('istio-system');
    await istioConfigPage.selectFilterCategory('Config');
    await istioConfigPage.expectNoActiveFilters();
  });

  test('Filters should be available in the dropdown', smokeCoreCaching, async ({ istioConfigPage }) => {
    await istioConfigPage.expectValidationDropdownVisible();
    await istioConfigPage.expectAllValidationFilterOptions();
  });

  test('Single validation filter should be usable', smokeCoreCaching, async ({ istioConfigPage }) => {
    await istioConfigPage.applyValidationFilter('Valid');
  });

  test('Filter should be deletable', smokeCoreCaching, async ({ istioConfigPage }) => {
    await istioConfigPage.applyValidationFilter('Valid');
    await istioConfigPage.removeActiveFilter('Valid');
  });

  test('Deleting all filters at once', smokeCoreCaching, async ({ istioConfigPage }) => {
    await istioConfigPage.applyValidationFilter('Valid');
    await istioConfigPage.clearAllFilters();
  });

  test('When 4 or more filters are chosen, only 3 are visible', smokeCoreCaching, async ({ istioConfigPage }) => {
    await istioConfigPage.chooseNValidationFilters(4);
    await istioConfigPage.expectActiveFilterCount(3);
  });

  test('Show the view of all validation filters', smokeCoreCaching, async ({ istioConfigPage }) => {
    await istioConfigPage.chooseNValidationFilters(4);
    await istioConfigPage.showMoreFilters();
    await istioConfigPage.expectActiveFilterCount(4);
  });

  test('Hide the menu of all chosen filters for validation', smokeCoreCaching, async ({ istioConfigPage }) => {
    await istioConfigPage.chooseNValidationFilters(4);
    await istioConfigPage.showMoreFilters();
    await istioConfigPage.expectActiveFilterCount(4);
    await istioConfigPage.clickShowLess();
    await istioConfigPage.expectActiveFilterCount(3);
  });
});
