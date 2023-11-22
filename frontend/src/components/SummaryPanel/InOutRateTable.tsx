import { Table, TableVariant, Tbody, Td, Th, Thead, Tr } from '@patternfly/react-table';
import { summaryTitle } from 'pages/Graph/SummaryPanelCommon';
import * as React from 'react';
import { kialiStyle } from 'styles/StyleUtils';
import { renderInOutRateChartHttp, renderInOutRateChartGrpc } from './RateChart';

const tableStyle = kialiStyle({
  marginBottom: '0.5rem'
});

type InOutRateTableGrpcPropType = {
  inRate: number;
  inRateGrpcErr: number;
  inRateNR: number;
  outRate: number;
  outRateGrpcErr: number;
  outRateNR: number;
  title: string;
};

export const InOutRateTableGrpc: React.FC<InOutRateTableGrpcPropType> = (props: InOutRateTableGrpcPropType) => {
  // for the table and graph
  const inErrRate: number = props.inRateGrpcErr + props.inRateNR;
  const outErrRate: number = props.outRateGrpcErr + props.outRateNR;
  const percentErrIn: number = props.inRate === 0 ? 0 : (inErrRate / props.inRate) * 100;
  const percentErrOut: number = props.outRate === 0 ? 0 : (outErrRate / props.outRate) * 100;
  const percentOkIn: number = 100 - percentErrIn;
  const percentOkOut: number = 100 - percentErrOut;

  return (
    <div>
      <div className={summaryTitle}>{props.title}</div>

      <Table className={tableStyle}>
        <Thead>
          <Tr>
            <Th />
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
            <Td>In</Td>
            <Td dataLabel="Total" textCenter>
              {props.inRate.toFixed(2)}
            </Td>
            <Td dataLabel="% Success" textCenter>
              {percentOkIn.toFixed(2)}
            </Td>
            <Td dataLabel="% Error" textCenter>
              {percentErrIn.toFixed(2)}
            </Td>
          </Tr>
          <Tr>
            <Td>Out</Td>
            <Td dataLabel="Total" textCenter>
              {props.outRate.toFixed(2)}
            </Td>
            <Td dataLabel="% Success" textCenter>
              {percentOkOut.toFixed(2)}
            </Td>
            <Td dataLabel="% Error" textCenter>
              {percentErrOut.toFixed(2)}
            </Td>
          </Tr>
        </Tbody>
      </Table>

      {renderInOutRateChartGrpc(percentOkIn, percentErrIn, percentOkOut, percentErrOut)}
    </div>
  );
};

type InOutRateTableHttpPropType = {
  inRate: number;
  inRate3xx: number;
  inRate4xx: number;
  inRate5xx: number;
  inRateNR: number;
  outRate: number;
  outRate3xx: number;
  outRate4xx: number;
  outRate5xx: number;
  outRateNR: number;
  title: string;
};

export const InOutRateTableHttp: React.FC<InOutRateTableHttpPropType> = (props: InOutRateTableHttpPropType) => {
  // for the table
  const inErrRate: number = props.inRate4xx + props.inRate5xx + props.inRateNR;
  const outErrRate: number = props.outRate4xx + props.outRate5xx + props.outRateNR;
  const percentInErr: number = props.inRate === 0 ? 0 : (inErrRate / props.inRate) * 100;
  const percentOutErr: number = props.outRate === 0 ? 0 : (outErrRate / props.outRate) * 100;
  const percentInSuccess: number = 100 - percentInErr;
  const percentOutSuccess: number = 100 - percentOutErr;

  // for the graphs
  const rate2xxIn: number =
    props.inRate === 0 ? 0 : props.inRate - props.inRate3xx - props.inRate4xx - props.inRate5xx - props.inRateNR;
  const rate2xxOut: number =
    props.outRate === 0 ? 0 : props.outRate - props.outRate3xx - props.outRate4xx - props.outRate5xx - props.outRateNR;
  const percent2xxIn: number = props.inRate === 0 ? 0 : (rate2xxIn / props.inRate) * 100;
  const percent3xxIn: number = props.inRate === 0 ? 0 : (props.inRate3xx / props.inRate) * 100;
  const percent4xxIn: number = props.inRate === 0 ? 0 : (props.inRate4xx / props.inRate) * 100;
  const percent5xxIn: number = props.inRate === 0 ? 0 : (props.inRate5xx / props.inRate) * 100;
  const percentNRIn: number = props.inRate === 0 ? 0 : (props.inRateNR / props.inRate) * 100;
  const percent2xxOut: number = props.outRate === 0 ? 0 : (rate2xxOut / props.outRate) * 100;
  const percent3xxOut: number = props.outRate === 0 ? 0 : (props.outRate3xx / props.outRate) * 100;
  const percent4xxOut: number = props.outRate === 0 ? 0 : (props.outRate4xx / props.outRate) * 100;
  const percent5xxOut: number = props.outRate === 0 ? 0 : (props.outRate5xx / props.outRate) * 100;
  const percentNROut: number = props.outRate === 0 ? 0 : (props.outRateNR / props.outRate) * 100;

  return (
    <div>
      <div className={summaryTitle}>{props.title}</div>

      <Table variant={TableVariant.compact} className={tableStyle}>
        <Thead>
          <Tr>
            <Th />
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
            <Td>In</Td>
            <Td dataLabel="Total" textCenter>
              {props.inRate.toFixed(2)}
            </Td>
            <Td dataLabel="% Success" textCenter>
              {percentInSuccess.toFixed(2)}
            </Td>
            <Td dataLabel="% Error" textCenter>
              {percentInErr.toFixed(2)}
            </Td>
          </Tr>
          <Tr>
            <Td>Out</Td>
            <Td dataLabel="Total" textCenter>
              {props.outRate.toFixed(2)}
            </Td>
            <Td dataLabel="% Success" textCenter>
              {percentOutSuccess.toFixed(2)}
            </Td>
            <Td dataLabel="% Error" textCenter>
              {percentOutErr.toFixed(2)}
            </Td>
          </Tr>
        </Tbody>
      </Table>

      {renderInOutRateChartHttp(
        percent2xxIn,
        percent3xxIn,
        percent4xxIn,
        percent5xxIn,
        percentNRIn,
        percent2xxOut,
        percent3xxOut,
        percent4xxOut,
        percent5xxOut,
        percentNROut
      )}
    </div>
  );
};
