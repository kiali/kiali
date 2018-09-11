import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import * as MessageCenter from '../../utils/MessageCenter';
import { URLParameter } from '../../types/Parameters';
import { Pagination } from '../../types/Pagination';

export namespace ListPage {
  const ACTION_APPEND = 'append';
  const ACTION_SET = 'set';

  const perPageOptions: number[] = [5, 10, 15];
  const defaultRateInterval = 600;

  export class Component<P, S> extends React.Component<RouteComponentProps<P>, S> {
    handleError = (error: string) => {
      MessageCenter.add(error);
    };

    onParamChange = (params: URLParameter[], paramAction?: string, historyAction?: string) => {
      const urlParams = new URLSearchParams(this.props.location.search);

      if (params.length > 0 && paramAction === ACTION_APPEND) {
        params.forEach(param => {
          urlParams.delete(param.name);
        });
      }

      params.forEach((param: URLParameter) => {
        if (param.value === '') {
          urlParams.delete(param.name);
        } else {
          if (paramAction === ACTION_APPEND) {
            urlParams.append(param.name, param.value);
          } else if (!paramAction || paramAction === ACTION_SET) {
            urlParams.set(param.name, param.value);
          }
        }
      });

      if (historyAction === 'replace') {
        this.props.history.replace(this.props.location.pathname + '?' + urlParams.toString());
      } else {
        this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
      }
    };

    onParamDelete = (params: string[]) => {
      const urlParams = new URLSearchParams(this.props.location.search);

      params.forEach(param => {
        urlParams.delete(param);
      });

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };

    getQueryParam = (queryName: string): string[] | undefined => {
      const urlParams = new URLSearchParams(this.props.location.search);
      const values = urlParams.getAll(queryName);

      if (values.length === 0) {
        return undefined;
      }

      return values;
    };

    getSingleQueryParam = (queryName: string): string | undefined => {
      const p = this.getQueryParam(queryName);
      return p === undefined ? undefined : p[0];
    };

    getSingleIntQueryParam = (queryName: string): number | undefined => {
      const p = this.getQueryParam(queryName);
      return p === undefined ? undefined : parseInt(p[0], 10);
    };

    currentPagination(): Pagination {
      return {
        page: this.getSingleIntQueryParam('page') || 1,
        perPage: this.getSingleIntQueryParam('perPage') || perPageOptions[1]
      };
    }

    isCurrentSortAscending() {
      return (this.getSingleQueryParam('direction') || 'asc') === 'asc';
    }

    currentRateInterval() {
      return this.getSingleIntQueryParam('rate') || defaultRateInterval;
    }
  }
}
