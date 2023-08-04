import { JWTRule } from '../../../types/IstioObjects';
import { Table, Tbody, Thead, Tr, Th, Td } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';
import * as React from 'react';
import { formatJwtField } from './JwtRuleBuilder';

type Props = {
  jwtRules: JWTRule[];
  onRemoveJwtRule: (index: number) => void;
};

const noJWTRulesStyle = kialiStyle({
  marginTop: 10,
  color: PFColors.Red100,
  textAlign: 'center',
  width: '100%'
});

export class JwtRuleList extends React.Component<Props> {
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
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <Thead>
            <Th width={100}>JWT Rules to be validated</Th>
            <Th />
          </Thead>
          <Tbody>
            {this.props.jwtRules.map((jwtRule, i) => (
              <Tr key={`jwtRule${i}`}>
                <Td>
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
                </Td>
                <Td />
              </Tr>
            ))}
          </Tbody>
        </Table>
        {this.props.jwtRules.length === 0 && <div className={noJWTRulesStyle}>No JWT Rules Defined</div>}
      </>
    );
  }
}
