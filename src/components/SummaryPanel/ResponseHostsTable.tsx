import * as React from 'react';
import _ from 'lodash';
import { style } from 'typestyle';
import { Responses } from '../../types/Graph';

type ResponseHostsTableProps = {
  responses: Responses;
  title: string;
};

interface Row {
  code: string;
  host: string;
  key: string;
  val: string;
}

const hostStyle = style({
  wordWrap: 'break-word'
});

export class ResponseHostsTable extends React.PureComponent<ResponseHostsTableProps> {
  render() {
    const rows = this.getRows(this.props.responses);

    return (
      <>
        {rows.length > 0 ? (
          <>
            <strong>{this.props.title}</strong>
            <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
              <thead>
                <tr key="table-header">
                  <th style={{ width: '18%' }}>Code</th>
                  <th style={{ width: '52%' }}>Host</th>
                  <th style={{ width: '30%' }}>% Req</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.key}>
                    <td>{row.code}</td>
                    <td className={hostStyle}>{row.host}</td>
                    <td>{row.val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>No Host Information Available</>
        )}
      </>
    );
  }

  private getRows = (responses: Responses): Row[] => {
    const rows: Row[] = [];
    _.keys(responses).forEach(code => {
      _.keys(responses[code].hosts).forEach(h => {
        rows.push({ key: `${code} ${h}`, code: code, host: h, val: responses[code].hosts[h] });
      });
    });
    return rows;
  };
}
