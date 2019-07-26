import * as React from 'react';
import _ from 'lodash';
import { Responses } from '../../types/Graph';
import responseFlags from '../../utils/ResponseFlags';

type ResponseTableProps = {
  responses: Responses;
  title: string;
};

interface Row {
  code: string;
  flags: string;
  key: string;
  val: string;
}

export class ResponseTable extends React.PureComponent<ResponseTableProps> {
  render() {
    return (
      <>
        <strong>{this.props.title}</strong>
        <table className="table">
          <thead>
            <tr key="table-header">
              <th>Code</th>
              <th>Flags</th>
              <th>% of Requests</th>
            </tr>
          </thead>
          <tbody>
            {this.getRows(this.props.responses).map(row => (
              <tr key={row.key}>
                <td>{row.code}</td>
                <td title={this.getTitle(row.flags)}>{row.flags}</td>
                <td>{row.val}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </>
    );
  }

  private getRows = (responses: Responses): Row[] => {
    const rows: Row[] = [];
    _.keys(responses).forEach(code => {
      _.keys(responses[code]).forEach(f => {
        rows.push({ key: `${code} ${f}`, code: code, flags: f, val: responses[code][f] });
      });
    });
    return rows;
  };

  private getTitle = (flags: string): string => {
    return flags
      .split(',')
      .map(flagToken => {
        flagToken = flagToken.trim();
        const flag = responseFlags[flagToken];
        return flagToken === '-' ? '' : `[${flagToken}] ${flag ? flag.help : 'Unknown Flag'}`;
      })
      .join('\n');
  };
}
