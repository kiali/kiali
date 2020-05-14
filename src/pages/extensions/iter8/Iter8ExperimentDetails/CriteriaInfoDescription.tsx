import * as React from 'react';
import {
  Card,
  CardBody,
  DataList,
  DataListItem,
  DataListItemCells,
  DataListItemRow,
  Grid,
  GridItem,
  DataListCell,
  List,
  ListItem,
  Text,
  DataListContent,
  DataListToggle,
  Tooltip
} from '@patternfly/react-core';
import { SuccessCriteria } from '../../../../types/Iter8';
import { Table, TableBody, TableHeader, IRow, ICell, cellWidth } from '@patternfly/react-table';
import { KialiIcon } from '../../../../config/KialiIcon';
import { style } from 'typestyle';
import { RenderComponentScroll } from '../../../../components/Nav/Page';

interface ExperimentInfoDescriptionProps {
  criterias: SuccessCriteria[];
}

type State = {
  criteriaExpanded: string[];
};

const statusIconStyle = style({
  fontSize: '2.0em'
});

class CriteriaInfoDescription extends React.Component<ExperimentInfoDescriptionProps, State> {
  constructor(props: ExperimentInfoDescriptionProps) {
    super(props);
    this.state = {
      criteriaExpanded: []
    };
  }

  criteriaHeader() {
    return [
      <DataListCell width={2}>
        <Text style={{ fontWeight: 'bold' }}> Metric Name</Text>
      </DataListCell>,
      <DataListCell width={2}>
        <Text style={{ fontWeight: 'bold' }}>Definitions</Text>
      </DataListCell>,
      <DataListCell width={5}>
        <Text style={{ fontWeight: 'bold' }}>Success Criteria Conclusions</Text>
      </DataListCell>,
      <DataListCell width={1}>
        <Text style={{ fontWeight: 'bold' }}>Status</Text>
      </DataListCell>
    ];
  }

  onCriteriaToggle = id => {
    const criteriaExpanded = this.state.criteriaExpanded;
    const index = criteriaExpanded.indexOf(id);
    const newCriteriaExpanded =
      index >= 0
        ? [...criteriaExpanded.slice(0, index), ...criteriaExpanded.slice(index + 1, criteriaExpanded.length)]
        : [...criteriaExpanded, id];
    this.setState(() => ({ criteriaExpanded: newCriteriaExpanded }));
  };

  criteriaList(criteria, idx) {
    return [
      <DataListCell key={'name_' + idx} width={2}>
        {criteria.name}
      </DataListCell>,
      <DataListCell key={'tolerance' + idx} width={2}>
        <ul>
          <li>Threshold : {criteria.criteria.tolerance}</li>
          <li>Threshold Type: {criteria.criteria.toleranceType}</li>
          <li>Sample Size: {criteria.criteria.sampleSize}</li>
        </ul>
      </DataListCell>,

      <DataListCell key={'tolerance' + idx} width={5}>
        <List>
          {criteria.status.conclusions &&
            criteria.status.conclusions.map((c, _) => {
              return <ListItem> {c} </ListItem>;
            })}
        </List>
      </DataListCell>,

      <DataListCell key={'success' + idx} width={1}>
        {this.getIcon(String(criteria.status.success_criterion_met))}
      </DataListCell>
    ];
  }

  columns = (): ICell[] => {
    return [{ title: 'Name', transforms: [cellWidth(15) as any] }, { title: 'Template' }];
  };

  getIcon = (s: string) => {
    switch (String(s)) {
      case 'true':
        return (
          <Tooltip content={<>{s}</>}>
            <KialiIcon.Ok className={statusIconStyle} />
          </Tooltip>
        );
      case 'false':
        return (
          <Tooltip content={<>{s}</>}>
            <KialiIcon.Error className={statusIconStyle} />
          </Tooltip>
        );
      default:
        return (
          <Tooltip content={<>{s}</>}>
            <KialiIcon.Ok className={statusIconStyle} />
          </Tooltip>
        );
    }
  };

  render() {
    return (
      <RenderComponentScroll>
        <Grid gutter="md" style={{ margin: '10px' }}>
          <GridItem span={12}>
            <Card>
              <CardBody>
                <DataList aria-label="simple-item1">
                  <DataListItemRow>
                    <DataListToggle
                      id={'none'}
                      className={'pf-c-button.pf-m-plain'}
                      style={{ display: 'block', visibility: 'hidden' }}
                    />
                    {this.criteriaHeader()}
                  </DataListItemRow>
                </DataList>

                {this.props.criterias.map((criteria, idx) => {
                  const rows: IRow[] = [
                    { cells: [{ title: 'Query Template' }, { title: criteria.metric.query_template }] },
                    { cells: [{ title: 'Sample Size Template' }, { title: criteria.metric.sample_size_template }] }
                  ];
                  return (
                    <DataList aria-label="simple-item2">
                      <DataListItem
                        aria-labelledby={'criteria' + idx}
                        isExpanded={this.state.criteriaExpanded.includes('criteria' + idx)}
                      >
                        <DataListItemRow>
                          <DataListToggle
                            onClick={() => this.onCriteriaToggle('criteria' + idx)}
                            isExpanded={this.state.criteriaExpanded.includes('criteria' + idx)}
                            id={'criteria' + idx}
                            aria-controls={'criteria' + idx}
                          />
                          <DataListItemCells dataListCells={this.criteriaList(criteria, idx)} />
                        </DataListItemRow>
                        <DataListContent
                          aria-label={'criteria' + idx}
                          id={'criteria' + idx + 'content'}
                          isHidden={!this.state.criteriaExpanded.includes('criteria' + idx)}
                        >
                          <Table aria-label="Simple Table" cells={this.columns()} rows={rows}>
                            <TableHeader />
                            <TableBody />
                          </Table>
                        </DataListContent>
                      </DataListItem>
                    </DataList>
                  );
                })}
              </CardBody>
            </Card>
          </GridItem>
        </Grid>
      </RenderComponentScroll>
    );
  }
}

export default CriteriaInfoDescription;
