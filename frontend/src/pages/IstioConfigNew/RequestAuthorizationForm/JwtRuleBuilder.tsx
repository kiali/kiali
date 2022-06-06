import * as React from 'react';
import { JWTHeader, JWTRule } from '../../../types/IstioObjects';
import { cellWidth, ICell, Table, TableBody, TableHeader } from '@patternfly/react-table';
import { Button, ButtonVariant, FormSelect, FormSelectOption } from '@patternfly/react-core';
import { PlusCircleIcon } from '@patternfly/react-icons';
import { TextInputBase as TextInput } from '@patternfly/react-core/dist/js/components/TextInput/TextInput';
import { style } from 'typestyle';
import { PFColors } from '../../../components/Pf/PfColors';
import { isValidUrl } from '../../../utils/IstioConfigUtils';

type Props = {
  onAddJwtRule: (rule: JWTRule) => void;
};

type State = {
  jwtRuleFields: string[];
  jwtRule: JWTRule;
  newJwtField: string;
  newValues: string;
};

const INIT_JWT_RULE_FIELDS = [
  'issuer',
  'audiences',
  'jwksUri',
  'jwks',
  'fromHeaders',
  'fromParams',
  'outputPayloadToHeader',
  'forwardOriginalToken'
].sort();

const headerCells: ICell[] = [
  {
    title: 'JWT Rule Field',
    transforms: [cellWidth(30) as any],
    props: {}
  },
  {
    title: 'Values',
    transforms: [cellWidth(70) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

const noValidStyle = style({
  color: PFColors.Red100
});

const warningStyle = style({
  marginLeft: 25,
  color: PFColors.Red100,
  textAlign: 'center'
});

export const formatJwtField = (jwtField: string, jwtRule: JWTRule): string => {
  switch (jwtField) {
    case 'issuer':
      return jwtRule.issuer ? jwtRule.issuer : '';
    case 'audiences':
      return jwtRule.audiences ? jwtRule.audiences.join(',') : '';
    case 'jwks':
      return jwtRule.jwks ? jwtRule.jwks : '';
    case 'jwksUri':
      return jwtRule.jwksUri ? jwtRule.jwksUri : '';
    case 'fromHeaders':
      return jwtRule.fromHeaders
        ? jwtRule.fromHeaders
            .map(header => {
              if (header.prefix) {
                return header.name + ': ' + header.prefix;
              } else {
                return header.name;
              }
            })
            .join(',')
        : '';
    case 'fromParams':
      return jwtRule.fromParams ? jwtRule.fromParams.join(',') : '';
    case 'outputPayloadToHeader':
      return jwtRule.outputPayloadToHeader ? jwtRule.outputPayloadToHeader : '';
    case 'forwardOriginalToken':
      return jwtRule.forwardOriginalToken ? '' + jwtRule.forwardOriginalToken : 'false';
    default:
  }
  return '';
};

class JwtRuleBuilder extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      jwtRuleFields: Object.assign([], INIT_JWT_RULE_FIELDS),
      jwtRule: {},
      newJwtField: 'issuer',
      newValues: ''
    };
  }

  onAddJwtField = (value: string, _) => {
    this.setState({
      newJwtField: value
    });
  };

  onAddNewValues = (value: string, _) => {
    this.setState({
      newValues: value
    });
  };

  onUpdateJwtRule = () => {
    this.setState(prevState => {
      const i = prevState.jwtRuleFields.indexOf(prevState.newJwtField);
      if (i > -1) {
        prevState.jwtRuleFields.splice(i, 1);
      }
      switch (prevState.newJwtField) {
        case 'issuer':
          prevState.jwtRule.issuer = prevState.newValues;
          break;
        case 'audiences':
          prevState.jwtRule.audiences = prevState.newValues.split(',');
          break;
        case 'jwks':
          prevState.jwtRule.jwks = prevState.newValues;
          break;
        case 'jwksUri':
          prevState.jwtRule.jwksUri = prevState.newValues;
          break;
        case 'fromHeaders':
          // Parse a string like:
          // "Authorization: Bearer , Authorization: Bearer, Security "
          // In [{name: 'Authorization', prefix: 'Bearer '}, {name: 'Authorization', prefix: 'Bearer'}, {name: 'Security}]
          prevState.jwtRule.fromHeaders = [];
          prevState.newValues.split(',').forEach(value => {
            const values = value.split(':');
            const header: JWTHeader = {
              name: values[0]
            };
            if (values.length > 1) {
              header.prefix = values[1].trimLeft();
            }
            if (prevState.jwtRule.fromHeaders) {
              prevState.jwtRule.fromHeaders.push(header);
            }
          });
          break;
        case 'fromParams':
          prevState.jwtRule.fromParams = prevState.newValues.split(',');
          break;
        case 'outputPayloadToHeader':
          prevState.jwtRule.outputPayloadToHeader = prevState.newValues;
          break;
        case 'forwardOriginalToken':
          // I don't want to put different types for input, perhaps in the future
          prevState.jwtRule.forwardOriginalToken = prevState.newValues.toLowerCase() === 'true';
          break;
        default:
        // No default action.
      }
      return {
        jwtRuleFields: prevState.jwtRuleFields,
        jwtRule: prevState.jwtRule,
        newJwtField: prevState.jwtRuleFields[0],
        newValues: ''
      };
    });
  };

  onAddJwtRuleToList = () => {
    const oldJwtRule = this.state.jwtRule;
    this.setState(
      {
        jwtRuleFields: Object.assign([], INIT_JWT_RULE_FIELDS),
        jwtRule: {},
        newJwtField: INIT_JWT_RULE_FIELDS[0],
        newValues: ''
      },
      () => this.props.onAddJwtRule(oldJwtRule)
    );
  };

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Field',
      // @ts-ignore
      onClick: (event, rowIndex, rowData, extraData) => {
        // Fetch sourceField from rowData, it's a fixed string on children
        const removeJwtRuleField = rowData.cells[0].props.children.toString();
        this.setState(prevState => {
          prevState.jwtRuleFields.push(removeJwtRuleField);
          delete prevState.jwtRule[removeJwtRuleField];
          const newJwtRuleFields = prevState.jwtRuleFields.sort();
          return {
            jwtRuleFields: newJwtRuleFields,
            jwtRule: prevState.jwtRule,
            newJwtField: newJwtRuleFields[0],
            newValues: ''
          };
        });
      }
    };
    if (rowIndex < Object.keys(this.state.jwtRule).length) {
      return [removeAction];
    }
    return [];
  };

  isJwtFieldValid = (): [boolean, string] => {
    const isEmptyValue = this.state.newValues.split(',').every(v => v.length === 0);
    if (isEmptyValue) {
      return [false, 'Value cannot be empty'];
    }
    if (this.state.newJwtField === 'jwksUri' && !isValidUrl(this.state.newValues)) {
      return [false, 'jwsUri is not a valid Uri'];
    }
    return [true, ''];
  };

  isJwtRuleValid = (): boolean => {
    return this.state.jwtRule.issuer ? this.state.jwtRule.issuer.length > 0 : false;
  };

  rows = () => {
    const jwtRuleRows = Object.keys(this.state.jwtRule).map((jwtField, i) => {
      return {
        key: 'jwtField' + i,
        cells: [<>{jwtField}</>, <>{formatJwtField(jwtField, this.state.jwtRule)}</>, <></>]
      };
    });
    if (this.state.jwtRuleFields.length > 0) {
      const [isJwtFieldValid, validText] = this.isJwtFieldValid();
      return jwtRuleRows.concat([
        {
          key: 'jwtFieldKeyNew',
          cells: [
            <>
              <FormSelect
                value={this.state.newJwtField}
                id="addNewJwtField"
                name="addNewJwtField"
                onChange={this.onAddJwtField}
              >
                {this.state.jwtRuleFields.map((option, index) => (
                  <FormSelectOption isDisabled={false} key={'jwt' + index} value={option} label={option} />
                ))}
              </FormSelect>
            </>,
            <>
              <TextInput
                value={this.state.newValues}
                type="text"
                id="addNewValues"
                key="addNewValues"
                aria-describedby="add new source values"
                name="addNewValues"
                onChange={this.onAddNewValues}
              />
              {this.state.newJwtField === 'fromHeaders' && (
                <div key="fromHeadersHelperText">
                  List of header locations from which JWT is expected. <br />
                  I.e. "x-jwt-assertion: Bearer ,Authorization: Bearer "
                </div>
              )}
              {!isJwtFieldValid && (
                <div key="hostsHelperText" className={noValidStyle}>
                  {validText}
                </div>
              )}
            </>,
            <>
              {this.state.jwtRuleFields.length > 0 && (
                <Button
                  variant={ButtonVariant.link}
                  icon={<PlusCircleIcon />}
                  onClick={this.onUpdateJwtRule}
                  isDisabled={!isJwtFieldValid}
                />
              )}
            </>
          ]
        }
      ]);
    }
    return jwtRuleRows;
  };

  render() {
    return (
      <>
        <Table
          aria-label="JWT Rule Builder"
          cells={headerCells}
          rows={this.rows()}
          // @ts-ignore
          actionResolver={this.actionResolver}
        >
          <TableHeader />
          <TableBody />
        </Table>
        <Button
          variant={ButtonVariant.link}
          icon={<PlusCircleIcon />}
          isDisabled={!this.isJwtRuleValid()}
          onClick={this.onAddJwtRuleToList}
        >
          Add JWT Rule
          {!this.isJwtRuleValid() && <span className={warningStyle}>A JWT Rule needs an "issuer"</span>}
        </Button>
      </>
    );
  }
}

export default JwtRuleBuilder;
