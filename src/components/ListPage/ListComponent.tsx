import * as React from 'react';
import { AxiosError } from 'axios';
import * as ListPagesHelper from './ListPagesHelper';
import { SortField } from '../../types/SortFilters';
import { Pagination } from '../../types/Pagination';
import * as API from '../../services/Api';
import { HistoryManager, URLParam } from '../../app/History';

export interface Props<R> {
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
    HistoryManager.deleteParam(URLParam.PAGE);
    this.updateListItems(true);
  };

  handleError = (error: string) => {
    ListPagesHelper.handleError(error);
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
          perPageOptions: ListPagesHelper.perPageOptions
        }
      };
    });
    HistoryManager.setParam(URLParam.PAGE, String(page));
  };

  perPageSelect = (perPage: number) => {
    this.setState(prevState => {
      return {
        listItems: prevState.listItems,
        pagination: {
          page: 1,
          perPage: perPage,
          perPageOptions: ListPagesHelper.perPageOptions
        }
      };
    });
    HistoryManager.setParams([
      { name: URLParam.PAGE, value: '1' },
      { name: URLParam.PER_PAGE, value: String(perPage) }
    ]);
  };

  updateSortField = (sortField: SortField<R>) => {
    this.sortItemList(this.state.listItems, sortField, this.state.isSortAscending).then(sorted => {
      this.setState({
        currentSortField: sortField,
        listItems: sorted
      });
      HistoryManager.setParam(URLParam.SORT, sortField.param);
    });
  };

  updateSortDirection = () => {
    this.sortItemList(this.state.listItems, this.state.currentSortField, !this.state.isSortAscending).then(sorted => {
      this.setState({
        isSortAscending: !this.state.isSortAscending,
        listItems: sorted
      });
      HistoryManager.setParam(URLParam.DIRECTION, this.state.isSortAscending ? 'asc' : 'desc');
    });
  };
}
