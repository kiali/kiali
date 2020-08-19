import * as React from 'react';
import * as FilterHelper from '../../../../components/FilterList/FilterHelper';
import { RenderContent } from '../../../../components/Nav/Page';
import ExperimentListContainer from './ExperimentListContainer';
import * as ExpListFilters from './FiltersAndSorts';

const ExperimentListPage: React.FunctionComponent = () => {
  return (
    <RenderContent>
      <ExperimentListContainer
        currentSortField={FilterHelper.currentSortField(ExpListFilters.sortFields)}
        isSortAscending={FilterHelper.isCurrentSortAscending()}
        activeNamespaces={[]}
      />
    </RenderContent>
  );
};

export default ExperimentListPage;
