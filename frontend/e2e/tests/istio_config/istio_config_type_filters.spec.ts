import { test } from '../../fixtures/kialiFixtures';

test.describe('Istio Config type filters', () => {
  test.beforeEach(async ({ istioConfigPage }) => {
    await istioConfigPage.openWithNamespace('istio-system');
    await istioConfigPage.selectFilterCategory('Type');
    await istioConfigPage.expectNoActiveFilters();
  });

  test('Fill the input form with nonsense @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.typeIntoTypeFilter('foo bar');
    await istioConfigPage.expectTypeFilterPhrase('No results found');
    await istioConfigPage.expectNoActiveFilters();
  });

  test('Filters should be available in the dropdown @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.expandTypeFilterDropdown();
    await istioConfigPage.expectAllTypeFilterOptions();
  });

  test('Single filter should be usable @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.applyTypeFilter('AuthorizationPolicy');
  });

  test('Multiple filters should be usable @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.applyMultipleTypeFilters(['AuthorizationPolicy', 'DestinationRule']);
  });

  test('Filter AuthorizationPolicy should be deletable @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.applyTypeFilter('AuthorizationPolicy');
    await istioConfigPage.removeActiveFilter('AuthorizationPolicy');
  });

  test('Deleting all filters at once in config @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.applyTypeFilter('AuthorizationPolicy');
    await istioConfigPage.clearAllFilters();
  });

  test('When 4 or more filters are chosen, only 3 are visible right away @smoke @core-caching', async ({
    istioConfigPage
  }) => {
    await istioConfigPage.chooseNTypeFilters(4);
    await istioConfigPage.expectActiveFilterCount(3);
  });

  test('Show the view of all type filters @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.chooseNTypeFilters(4);
    await istioConfigPage.showMoreFilters();
    await istioConfigPage.expectActiveFilterCount(4);
  });

  test('Hide the menu of all chosen filters @smoke @core-caching', async ({ istioConfigPage }) => {
    await istioConfigPage.chooseNTypeFilters(4);
    await istioConfigPage.showMoreFilters();
    await istioConfigPage.expectActiveFilterCount(4);
    await istioConfigPage.clickShowLess();
    await istioConfigPage.expectActiveFilterCount(3);
  });
});
