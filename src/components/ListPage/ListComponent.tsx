import * as React from 'react';
import { AxiosError } from 'axios';
import { ListPage } from './ListPage';
import { SortField } from '../../types/SortFilters';
import { Pagination } from '../../types/Pagination';
import * as API from '../../services/Api';

export namespace ListComponent {
  export interface Props<R> {
    pageHooks: ListPage.Hooks;
    pagination: Pagination;
    currentSortField: SortField<R>;
    isSortAscending: boolean;
  }

  export interface State<R> {
    listItems: R[];
    pagination: Pagination;
    currentSortField: SortField<R>;
    isSortAscending: boolean;
  }

  export abstract class Component<P extends Props<R>, S extends State<R>, R> extends React.Component<P, S> {
    abstract sortItemList(listItems: R[], sortField: SortField<R>, isAscending: boolean): Promise<R[]>;
    abstract updateListItems(resetPagination?: boolean): void;

    constructor(props: P) {
      super(props);

      this.updateListItems = this.updateListItems.bind(this);
      this.sortItemList = this.sortItemList.bind(this);
    }

    onFilterChange = () => {
      // Resetting pagination when filters change
      this.props.pageHooks.onParamChange([{ name: 'page', value: '' }]);
      this.updateListItems(true);
    };

    handleError = (error: string) => {
      this.props.pageHooks.handleError(error);
    };

    handleAxiosError(message: string, error: AxiosError) {
      const errMsg = API.getErrorMsg(message, error);
      console.error(errMsg);
      this.handleError(errMsg);
    }

    pageSet = (page: number) => {
      this.setState(prevState => {
        return {
          listItems: prevState.listItems,
          pagination: {
            page: page,
            perPage: prevState.pagination.perPage,
            perPageOptions: ListPage.perPageOptions
          }
        };
      });

      this.props.pageHooks.onParamChange([{ name: 'page', value: String(page) }]);
    };

    perPageSelect = (perPage: number) => {
      this.setState(prevState => {
        return {
          listItems: prevState.listItems,
          pagination: {
            page: 1,
            perPage: perPage,
            perPageOptions: ListPage.perPageOptions
          }
        };
      });

      this.props.pageHooks.onParamChange([{ name: 'page', value: '1' }, { name: 'perPage', value: String(perPage) }]);
    };

    updateSortField = (sortField: SortField<R>) => {
      this.sortItemList(this.state.listItems, sortField, this.state.isSortAscending).then(sorted => {
        this.setState({
          currentSortField: sortField,
          listItems: sorted
        });

        this.props.pageHooks.onParamChange([{ name: 'sort', value: sortField.param }]);
      });
    };

    updateSortDirection = () => {
      this.sortItemList(this.state.listItems, this.state.currentSortField, !this.state.isSortAscending).then(sorted => {
        this.setState({
          isSortAscending: !this.state.isSortAscending,
          listItems: sorted
        });

        this.props.pageHooks.onParamChange([{ name: 'direction', value: this.state.isSortAscending ? 'asc' : 'desc' }]);
      });
    };
  }
}
