import * as React from 'react';
import _ from 'lodash';
import { kialiStyle } from 'styles/StyleUtils';
import { Responses } from '../../types/Graph';
import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';
import { Table, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';

const tableStyle = kialiStyle({
  $nest: {
    '& tr > *': {
      paddingLeft: 0,
      paddingRight: 0
    },
    '& tbody > tr:last-child': {
      borderBottom: 0
    }
  }
});

const noInfoStyle = kialiStyle({
  marginTop: '0.5rem'
});

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

export const ResponseHostsTable: React.FC<ResponseHostsTableProps> = (props: ResponseHostsTableProps) => {
  const getRows = (responses: Responses): Row[] => {
    const rows: Row[] = [];
    _.keys(responses).forEach(code => {
      _.keys(responses[code].hosts).forEach(h => {
        rows.push({ key: `${code} ${h}`, code: code, host: h, val: responses[code].hosts[h] });
      });
    });

    return rows;
  };

  const rows = getRows(props.responses);

  return (
    <>
      {rows.length > 0 ? (
        <>
          <div className={summaryTitle}>{props.title}</div>

          <Table className={tableStyle}>
            <Thead>
              <Tr>
                <Th dataLabel="Code" width={20} textCenter>
                  Code
                </Th>
                <Th dataLabel="Host" width={50} textCenter>
                  Host
                </Th>
                <Th dataLabel="% Req" width={30} textCenter>
                  % Req
                </Th>
              </Tr>
            </Thead>

            <Tbody>
              {rows.map(row => (
                <Tr key={row.key}>
                  <Td dataLabel="Code" textCenter>
                    {row.code}
                  </Td>
                  <Td dataLabel="Host" modifier="truncate" textCenter>
                    {row.host}
                  </Td>
                  <Td dataLabel="% Req" textCenter>
                    {row.val}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </>
      ) : (
        <div className={noInfoStyle}>No Host Information Available</div>
      )}
    </>
  );
};
