import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { renderRateChartHttp, renderRateChartGrpc } from './RateChart';

const tableStyle = kialiStyle({
  marginBottom: '0.5rem'
});

type RateTableGrpcPropType = {
  isRequests: boolean;
  rate: number;
  rateGrpcErr: number;
  rateNR: number;
};

type RateTableTcpPropType = {
  rate: number;
};

export const RateTableGrpc: React.FC<RateTableGrpcPropType> = (props: RateTableGrpcPropType) => {
  // for the table and graph
  const title = `gRPC Traffic (${props.isRequests ? 'requests' : 'messages'} per second)`;
  const errRate: number = props.rateGrpcErr + props.rateNR;
  const percentErr: number = props.rate === 0 ? 0 : (errRate / props.rate) * 100;
  const percentOK: number = 100 - percentErr;

  return (
    <div>
      <div className={summaryTitle}>{title}</div>

      <Table>
        <Thead>
          <Tr>
            <Th dataLabel="Total" textCenter>
              Total
            </Th>
            <Th dataLabel="% Success" textCenter>
              % Success
            </Th>
            <Th dataLabel="% Error" textCenter>
              % Error
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td dataLabel="Total" textCenter>
              {props.rate.toFixed(2)}
            </Td>
            <Td dataLabel="% Success" textCenter>
              {props.isRequests ? percentOK.toFixed(2) : '-'}
            </Td>
            <Td dataLabel="% Error" textCenter>
              {props.isRequests ? percentErr.toFixed(2) : '-'}
            </Td>
          </Tr>
        </Tbody>
      </Table>

      {props.isRequests && renderRateChartGrpc(percentOK, percentErr)}
    </div>
  );
};

type RateTableHttpPropType = {
  title: string;
  rate: number;
  rate3xx: number;
  rate4xx: number;
  rate5xx: number;
  rateNR: number;
};

export const RateTableHttp: React.FC<RateTableHttpPropType> = (props: RateTableHttpPropType) => {
  // for the table
  const errRate: number = props.rate4xx + props.rate5xx + props.rateNR;
  const percentErr: number = props.rate === 0 ? 0 : (errRate / props.rate) * 100;
  const successErr: number = 100 - percentErr;

  // for the graph
  const rate2xx: number =
    props.rate === 0 ? 0 : props.rate - props.rate3xx - props.rate4xx - props.rate5xx - props.rateNR;
  const percent2xx: number = props.rate === 0 ? 0 : (rate2xx / props.rate) * 100;
  const percent3xx: number = props.rate === 0 ? 0 : (props.rate3xx / props.rate) * 100;
  const percent4xx: number = props.rate === 0 ? 0 : (props.rate4xx / props.rate) * 100;
  const percent5xx: number = props.rate === 0 ? 0 : (props.rate5xx / props.rate) * 100;
  const percentNR: number = props.rate === 0 ? 0 : (props.rateNR / props.rate) * 100;

  return (
    <div>
      <div className={summaryTitle}>{props.title}</div>

      <Table variant={TableVariant.compact} className={tableStyle}>
        <Thead>
          <Tr>
            <Th dataLabel="Total" textCenter>
              Total
            </Th>
            <Th dataLabel="% Success" textCenter>
              % Success
            </Th>
            <Th dataLabel="% Error" textCenter>
              % Error
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td dataLabel="Total" textCenter>
              {props.rate.toFixed(2)}
            </Td>
            <Td dataLabel="% Success" textCenter>
              {successErr.toFixed(2)}
            </Td>
            <Td dataLabel="% Error" textCenter>
              {percentErr.toFixed(2)}
            </Td>
          </Tr>
        </Tbody>
      </Table>

      {renderRateChartHttp(percent2xx, percent3xx, percent4xx, percent5xx, percentNR)}
    </div>
  );
};

export const RateTableTcp: React.FC<RateTableTcpPropType> = (props: RateTableTcpPropType) => {
  const title = 'TCP Traffic (bytes per second)';

  return (
    <div>
      <div className={summaryTitle}>{title}</div>

      <Table>
        <Thead>
          <Tr>
            <Th dataLabel="Total" textCenter>
              Total
            </Th>
            <Th dataLabel="% Success" textCenter>
              % Success
            </Th>
            <Th dataLabel="% Error" textCenter>
              % Error
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          <Tr>
            <Td dataLabel="Total" textCenter>
              {props.rate.toFixed(2)}
            </Td>
            <Td dataLabel="% Success" textCenter>
              {'-'}
            </Td>
            <Td dataLabel="% Error" textCenter>
              {'-'}
            </Td>
          </Tr>
        </Tbody>
      </Table>
    </div>
  );
};
