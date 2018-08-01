import * as React from 'react';
import { RouteComponentProps } from 'react-router';
import * as MessageCenter from '../../utils/MessageCenter';
import { URLParameter } from '../../types/Parameters';

export namespace ListPage {
  const ACTION_APPEND = 'append';
  const ACTION_SET = 'set';

  export class Component<P, S> extends React.Component<RouteComponentProps<P>, S> {
    handleError = (error: string) => {
      MessageCenter.add(error);
    };

    onParamChange = (params: URLParameter[], action?: string) => {
      const urlParams = new URLSearchParams(this.props.location.search);

      if (params.length > 0 && action === ACTION_APPEND) {
        params.forEach(param => {
          urlParams.delete(param.name);
        });
      }

      params.forEach((param: URLParameter) => {
        if (action === ACTION_APPEND) {
          urlParams.append(param.name, param.value);
        } else if (!action || action === ACTION_SET) {
          urlParams.set(param.name, param.value);
        }
      });

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };

    onParamDelete = (params: string[]) => {
      const urlParams = new URLSearchParams(this.props.location.search);

      params.forEach(param => {
        urlParams.delete(param);
      });

      this.props.history.push(this.props.location.pathname + '?' + urlParams.toString());
    };

    getQueryParam = (queryName: string, whenEmpty: string[]): string[] => {
      const urlParams = new URLSearchParams(this.props.location.search);
      let values = urlParams.getAll(queryName);

      if (values.length === 0) {
        values = whenEmpty;
      }

      return values;
    };
  }
}
