import { JWTRule } from '../../../types/IstioObjects';
import { IRow, ThProps } from '@patternfly/react-table';
import { kialiStyle } from 'styles/StyleUtils';
import { PFColors } from '../../../components/Pf/PfColors';
import * as React from 'react';
import { formatJwtField } from './JwtRuleBuilder';
import { SimpleTable } from 'components/Table/SimpleTable';
import { Button, ButtonVariant } from '@patternfly/react-core';
import { KialiIcon } from 'config/KialiIcon';

type JwtRuleListProps = {
  jwtRules: JWTRule[];
  onRemoveJwtRule: (index: number) => void;
};

const columns: ThProps[] = [
  {
    title: 'JWT Rules to be validated',
    width: 100
  },
  {
    title: ''
  }
];

const noJWTRulesStyle = kialiStyle({
  color: PFColors.Red100,
  textAlign: 'center'
});

export const JwtRuleList: React.FC<JwtRuleListProps> = (props: JwtRuleListProps) => {
  const rows: IRow[] = props.jwtRules.map((jwtRule, i) => {
    return {
      key: `jwtRule_${i}`,
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

        <Button
          id="removeToOperationBtn"
          variant={ButtonVariant.link}
          icon={<KialiIcon.Delete />}
          onClick={() => props.onRemoveJwtRule(i)}
        />
      ]
    };
  });

  const noJWTRules = <div className={noJWTRulesStyle}>No JWT Rules Defined</div>;

  return <SimpleTable label="JWT Rules List" columns={columns} rows={rows} emptyState={noJWTRules} />;
};
