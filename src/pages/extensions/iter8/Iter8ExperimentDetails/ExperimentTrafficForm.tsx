import { cellWidth, ICell, IRow, Table, TableBody, TableHeader, wrappable } from '@patternfly/react-table';
import { Criteria, HeaderMatch, Host, HttpMatch, initCriteria } from '../../../../types/Iter8';
import * as React from 'react';
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  Divider,
  FormGroup,
  FormSelect,
  FormSelectOption,
  Grid,
  GridItem,
  TextInput,
  ButtonVariant
} from '@patternfly/react-core';
import { PfColors } from '../../../../components/Pf/PfColors';

const MatchOptions = [
  { value: '', label: '--- select ---' },
  { value: 'exact', label: 'exact string match' },
  { value: 'prefix', label: 'prefix-based match' },
  { value: 'regex', label: 'ECMAscript style regex-based match' }
];

const headerCells: ICell[] = [
  {
    title: 'header keys',
    transforms: [wrappable, cellWidth(20) as any],
    props: {}
  },
  {
    title: 'match',
    transforms: [cellWidth(35) as any],
    props: {}
  },
  {
    title: 'string match',
    transforms: [cellWidth(20) as any],
    props: {}
  },
  {
    title: '',
    props: {}
  }
];

type Props = {
  matches: HttpMatch[];
  onRemove: (type: string, index: number) => void;
  onAdd: (criteria: Criteria, host: Host, match: any) => void;
};

export type TrafficState = {
  addMatch: HttpMatch;
  addHeader: HeaderMatch;
  focusElementName: string;
  validName: boolean;
};

export const initMatch = (): TrafficState => ({
  addMatch: {
    uri: {
      match: '',
      stringMatch: ''
    },
    headers: []
  },
  addHeader: {
    key: '',
    match: '',
    stringMatch: ''
  },
  focusElementName: 'Unknown',
  validName: false
});

// Create Success Criteria, can be multiple with same metric, but different sampleSize, etc...
class ExperimentTrafficForm extends React.Component<Props, TrafficState> {
  constructor(props: Props) {
    super(props);
    this.state = initMatch();
  }

  // @ts-ignore
  actionResolver = (rowData, { rowIndex }) => {
    const removeAction = {
      title: 'Remove Header',
      // @ts-ignore
      onClick: (event, rowIndex) => {
        this.onHeaderRemove(rowIndex);
      }
    };
    if (rowIndex < this.state.addMatch.headers.length) {
      return [removeAction];
    }
    return [];
  };

  componentDidUpdate() {
    if (this.state.focusElementName !== '') {
      const focusElement = document.getElementById(this.state.focusElementName);
      if (focusElement) {
        focusElement.focus();
      }
    }
  }

  onAddMatch = (value: string, _) => {
    this.setState(prevState => ({
      addMatch: {
        uri: {
          match: value.trim(),
          stringMatch: prevState.addMatch.uri.stringMatch
        },
        headers: prevState.addMatch.headers
      },
      focusElementName: 'Unknow',
      validName: true
    }));
  };

  onAddUriMatch = (value: string) => {
    this.setState(prevState => ({
      addMatch: {
        uri: {
          match: value.trim(),
          stringMatch: prevState.addMatch.uri.stringMatch
        },
        headers: prevState.addMatch.headers
      },
      focusElementName: 'Unknow',
      validName: true
    }));
  };

  onAddUriMatchString = (value: string) => {
    this.setState(prevState => ({
      addMatch: {
        uri: {
          match: prevState.addMatch.uri.match,
          stringMatch: value.trim()
        },
        headers: prevState.addMatch.headers
      },
      focusElementName: 'Unknow',
      validName: true
    }));
  };

  onAddHeader = () => {
    this.setState(prevState => ({
      addMatch: {
        uri: {
          match: prevState.addMatch.uri.match,
          stringMatch: prevState.addMatch.uri.stringMatch
        },
        headers: prevState.addMatch.headers.concat(this.state.addHeader)
      },
      addHeader: {
        key: '',
        match: '',
        stringMatch: ''
      },
      focusElementName: 'Unknown'
    }));
  };

  onHeaderRemove = (index: number) => {
    this.setState(prevState => {
      prevState.addMatch.headers.splice(index, 1);
      return {
        addMatch: prevState.addMatch,
        addHeader: prevState.addHeader,
        focusElementName: 'UNknown'
      };
    });
  };

  onAddHeaderValue = (field: string, value: string) => {
    this.setState(prevState => {
      const headerInfo = prevState.addHeader;
      switch (field) {
        case 'addNewHeaderKey':
          headerInfo.key = value.trim();
          break;
        case 'addNewHeaderMatch':
          headerInfo.match = value.trim();
          break;
        case 'addNewHeaderStringMatch':
          headerInfo.stringMatch = value.trim();
          break;
        default:
      }
      return {
        addMatch: prevState.addMatch,
        addHeader: headerInfo,
        focusElementName: field
      };
    });
  };

  onAddMatchRules = () => {
    this.props.onAdd(initCriteria(), { name: '', gateway: '' }, this.state.addMatch);
    this.setState({
      addMatch: {
        uri: {
          match: '',
          stringMatch: ''
        },
        headers: []
      },
      addHeader: {
        key: '',
        match: '',
        stringMatch: ''
      },
      focusElementName: 'Unknown',
      validName: false
    });
  };

  rows = (): IRow[] => {
    return this.state.addMatch.headers
      .map((header, i) => ({
        key: 'header' + i,
        cells: [<>{header.key}</>, <>{header.match}</>, <>{header.stringMatch}</>]
      }))
      .concat([
        {
          key: 'Header',
          cells: [
            <>
              <TextInput
                id="addNewHeaderKey"
                placeholder="Key"
                value={this.state.addHeader.key}
                onChange={value => this.onAddHeaderValue('addNewHeaderKey', value)}
              />
            </>,
            <>
              <FormSelect
                id="addNewHeaderMatch"
                onChange={value => this.onAddHeaderValue('addNewHeaderMatch', value)}
                value={this.state.addHeader.match}
              >
                {MatchOptions.map((mt, index) => (
                  <FormSelectOption label={mt.label} key={'mt' + index} value={mt.value} />
                ))}
              </FormSelect>
            </>,
            <FormGroup fieldId="faddNewHeaderStringMatch" isValid={this.state.addHeader.stringMatch.length > 0}>
              <TextInput
                id="addNewHeaderStringMatch"
                placeholder="match string"
                onChange={value => this.onAddHeaderValue('addNewHeaderStringMatch', value)}
                value={this.state.addHeader.stringMatch}
              />
            </FormGroup>,
            <>
              <Button
                id="addHostBtn"
                aria-label="slider-text"
                variant="secondary"
                isDisabled={
                  this.state.addHeader.key === '' ||
                  this.state.addHeader.match === '' ||
                  this.state.addHeader.stringMatch === ''
                }
                onClick={this.onAddHeader}
              >
                Add this Header
              </Button>
            </>
          ]
        }
      ]);
  };

  matchrows(match) {
    return match.headers.map((header, i) => ({
      key: 'uri' + i,
      cells: [<>{header.key}</>, <>{header.match}</>, <>{header.stringMatch}</>, '']
    }));
  }

  render() {
    return this.props.matches
      .map((match, i) => (
        <>
          <Card style={{ backgroundColor: i % 2 === 0 ? PfColors.GrayBackground : PfColors.White }}>
            <CardHeader>
              HTTP Match Request {i + 1}
              <span style={{ float: 'right', paddingRight: '5px' }}>
                <Button variant={ButtonVariant.secondary} onClick={() => this.props.onRemove('Match', i)}>
                  Remove
                </Button>
              </span>
            </CardHeader>
            <CardBody>
              <Grid gutter="md">
                <GridItem span={6}>
                  <FormGroup fieldId="matchSelect" label="URI Match criterion">
                    <FormSelect id="match" value={match.uri.match} isDisabled>
                      {MatchOptions.map((mt, index) => (
                        <FormSelectOption label={mt.label} key={'gateway' + index} value={mt.value} />
                      ))}
                    </FormSelect>
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup fieldId="stringMatch" label="URI Match">
                    <TextInput isDisabled id={'stringMatch'} placeholder="match string" value={match.uri.stringMatch} />
                  </FormGroup>
                </GridItem>
                <GridItem span={12}>
                  <Table aria-label="HTTP Match Requests" cells={headerCells} rows={this.matchrows(match)}>
                    <TableHeader />
                    <TableBody />
                  </Table>
                </GridItem>
              </Grid>
            </CardBody>
          </Card>
          <Divider />
        </>
      ))
      .concat(
        <>
          <Card>
            <CardHeader>
              New HTTP Match Request
              <span style={{ float: 'right', paddingRight: '5px' }}>
                <Button
                  variant={ButtonVariant.secondary}
                  isDisabled={
                    (this.state.addMatch.uri.match.length === 0 || this.state.addMatch.uri.stringMatch.length === 0) &&
                    this.state.addMatch.headers.length === 0
                  }
                  onClick={() => this.onAddMatchRules()}
                >
                  Add Match Rule
                </Button>
              </span>
            </CardHeader>
            <CardBody>
              <Grid gutter="md">
                <GridItem span={6}>
                  <FormGroup fieldId="matchSelect" label="URI Match criterion">
                    <FormSelect id="match" value={this.state.addMatch.uri.match} onChange={this.onAddUriMatch}>
                      {MatchOptions.map((mt, index) => (
                        <FormSelectOption label={mt.label} key={'gateway' + index} value={mt.value} />
                      ))}
                    </FormSelect>
                  </FormGroup>
                </GridItem>
                <GridItem span={6}>
                  <FormGroup fieldId="stringMatch" label="Match String">
                    <TextInput
                      id={'stringMatch'}
                      placeholder="match string"
                      value={this.state.addMatch.uri.stringMatch}
                      onChange={value => this.onAddUriMatchString(value)}
                    />
                  </FormGroup>
                </GridItem>
                <GridItem span={12}>
                  <Table
                    aria-label="HTTP Match Requests"
                    cells={headerCells}
                    rows={this.rows()}
                    // @ts-ignore
                    actionResolver={this.actionResolver}
                  >
                    <TableHeader />
                    <TableBody />
                  </Table>
                </GridItem>
              </Grid>
            </CardBody>
          </Card>
        </>
      );
  }
}

export default ExperimentTrafficForm;
