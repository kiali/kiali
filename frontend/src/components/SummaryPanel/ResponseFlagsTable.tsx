import * as React from 'react';
import _ from 'lodash';
import { Responses } from '../../types/Graph';
import { responseFlags } from '../../utils/ResponseFlags';
import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';
import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';

const tableStyle = kialiStyle({
  $nest: {
    '& tbody > tr:last-child': {
      borderBottom: 0
    }
  }
});

type ResponseFlagsTableProps = {
  responses: Responses;
  title: string;
};

interface Row {
  code: string;
  flags: string;
  key: string;
  val: string;
}

export const ResponseFlagsTable: React.FC<ResponseFlagsTableProps> = (props: ResponseFlagsTableProps) => {
  const getRows = (responses: Responses): Row[] => {
    const rows: Row[] = [];
    _.keys(responses).forEach(code => {
      _.keys(responses[code].flags).forEach(f => {
        rows.push({ key: `${code} ${f}`, code: code, flags: f, val: responses[code].flags[f] });
      });
    });

    return rows;
  };

  const getTitle = (flags: string): string => {
    return flags
      .split(',')
      .map(flagToken => {
        flagToken = flagToken.trim();
        const flag = responseFlags[flagToken];
        return flagToken === '-' ? '' : `[${flagToken}] ${flag ? flag.help : 'Unknown Flag'}`;
      })
      .join('\n');
  };

  const rows = getRows(props.responses);

  return (
    <>
      <div className={summaryTitle}>{props.title}</div>

      <Table variant={TableVariant.compact} className={tableStyle}>
        <Thead>
          <Tr key="table-header">
            <Th dataLabel="Code" textCenter>
              Code
            </Th>
            <Th dataLabel="Flags" textCenter>
              Flags
            </Th>
            <Th dataLabel="% Req" textCenter>
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
              <Td dataLabel="Flags" title={getTitle(row.flags)} textCenter>
                {row.flags}
              </Td>
              <Td dataLabel="% Req" textCenter>
                {row.val}
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </>
  );
};
