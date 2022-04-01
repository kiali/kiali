import { JWTRule } from '../../../types/IstioObjects';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';
import * as React from 'react';
import { formatJwtField } from './JwtRuleBuilder';

type Props = {
  jwtRules: JWTRule[];
  onRemoveJwtRule: (index: number) => void;
};

const headerCells: ICell[] = [
  {
    title: 'JWT Rules to be validated',
    transforms: [cellWidth(100) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const noJWTRulesStyle = style({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

class JwtRuleList extends React.Component<Props> {
  rows = () => {
    return this.props.jwtRules.map((jwtRule, i) => {
      return {
        key: 'jwtRule' + i,
        cells: [
          <>
            {jwtRule.issuer ? (
              <div>
                <b>issuer</b>: [{formatJwtField('issuer', jwtRule)}]
              </div>
            ) : undefined}
            {jwtRule.audiences ? (
              <div>
                <b>audiences</b>: [{formatJwtField('audiences', jwtRule)}]
              </div>
            ) : undefined}
            {jwtRule.jwks ? (
              <div>
                <b>jwks</b>: [{formatJwtField('jwks', jwtRule)}]
              </div>
            ) : undefined}
            {jwtRule.jwksUri ? (
              <div>
                <b>jwksUri</b>: [{formatJwtField('jwksUri', jwtRule)}]
              </div>
            ) : undefined}
            {jwtRule.fromHeaders ? (
              <div>
                <b>fromHeaders</b>: [{formatJwtField('fromHeaders', jwtRule)}]
              </div>
            ) : undefined}
            {jwtRule.fromParams ? (
              <div>
                <b>fromParams</b>: [{formatJwtField('fromParams', jwtRule)}]
              </div>
            ) : undefined}
            {jwtRule.outputPayloadToHeader ? (
              <div>
                <b>outputPayloadToHeader</b>: [{formatJwtField('outputPayloadToHeader', jwtRule)}]
              </div>
            ) : undefined}
            {jwtRule.forwardOriginalToken !== undefined ? (
              <div>
                <b>forwardOriginalToken</b>: [{formatJwtField('forwardOriginalToken', jwtRule)}]
              </div>
            ) : undefined}
          </>,
          <></>
        ]
      };
    });
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove JWT Rule',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        this.props.onRemoveJwtRule(rowIndex);
      }
    };
    return [removeAction];
  };

  render() {
    return (
      <>
        <Table
          aria-label="JWT Rules List"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        {this.props.jwtRules.length === 0 && <div className={noJWTRulesStyle}>No JWT Rules Defined</div>}
      </>
    );
  }
}

export default JwtRuleList;
