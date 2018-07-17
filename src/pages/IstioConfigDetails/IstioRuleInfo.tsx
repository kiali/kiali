import * as React from 'react';
import { ListView, ListViewItem, Row, Col, Table, Card, CardTitle, CardBody, Icon, Button } from 'patternfly-react';
import * as resolve from 'table-resolver';
import './IstioRuleInfo.css';
import { aceOptions, safeDumpOptions, IstioRuleDetails } from '../../types/IstioConfigDetails';
import { Link } from 'react-router-dom';
import AceEditor from 'react-ace';
import 'brace/mode/yaml';
import 'brace/theme/eclipse';
import { kialiRoute } from '../../routes';
import { ParsedSearch } from './IstioConfigDetailsPage';
import { dicIstioType } from '../../types/IstioConfigListComponent';

const yaml = require('js-yaml');

interface IstioRuleInfoProps {
  namespace: string;
  rule: IstioRuleDetails;
  onRefresh: () => void;
  parsedSearch?: ParsedSearch;
}

class IstioRuleInfo extends React.Component<IstioRuleInfoProps> {
  constructor(props: IstioRuleInfoProps) {
    super(props);
  }

  headerFormat = (label, { column }) => <Table.Heading className={column.property}>{label}</Table.Heading>;
  cellFormat = (value, { column }) => {
    const props = column.cell.props;
    const className = props ? props.align : '';

    return <Table.Cell className={className}>{value}</Table.Cell>;
  };

  getPathname(): string {
    return kialiRoute('/namespaces/' + this.props.namespace + '/istio/rules/' + this.props.rule.name);
  }

  editorContent(parsedSearch: ParsedSearch) {
    if (parsedSearch && parsedSearch.type && parsedSearch.name) {
      if (parsedSearch.type === 'handler') {
        let handler = parsedSearch.name.split('.');
        for (let i = 0; i < this.props.rule.actions.length; i++) {
          let action = this.props.rule.actions[i];
          if (action.handler.name === handler[0] && action.handler.adapter === handler[1]) {
            return yaml.safeDump(action.handler.spec, safeDumpOptions);
          }
        }
      } else if (parsedSearch.type === 'instance') {
        let instance = parsedSearch.name.split('.');
        for (let i = 0; i < this.props.rule.actions.length; i++) {
          for (let j = 0; j < this.props.rule.actions[i].instances.length; j++) {
            let actionInstance = this.props.rule.actions[i].instances[j];
            if (actionInstance.name === instance[0] && actionInstance.template === instance[1]) {
              return yaml.safeDump(actionInstance.spec, safeDumpOptions);
            }
          }
        }
      }
    }
    return '';
  }

  columns() {
    return {
      columns: [
        {
          property: 'instanceName',
          header: {
            label: 'Instance Name',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },
        {
          property: 'instanceTemplate',
          header: {
            label: 'Template',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        },

        {
          property: 'instanceActions',
          header: {
            label: 'Actions',
            formatters: [this.headerFormat]
          },
          cell: {
            formatters: [this.cellFormat]
          }
        }
      ]
    };
  }

  renderInstances(): any[] {
    let instances: any[] = [];
    this.props.rule.actions.forEach(rAction => {
      let rActionDescription: any = (
        <div>
          <div>
            <strong>Handler Name:</strong> {rAction.handler.name}
          </div>
          <div>
            <strong>Adapter:</strong> {rAction.handler.adapter}
          </div>
        </div>
      );
      let handlerLink: any = (
        <Link
          id={rAction.handler.name + '.' + rAction.handler.adapter}
          to={{
            pathname: this.getPathname(),
            search: '?handler=' + rAction.handler.name + '.' + rAction.handler.adapter
          }}
        >
          View YAML
        </Link>
      );
      instances.push(
        <ListViewItem
          key={rAction}
          heading={'Action'}
          description={rActionDescription}
          hideCloseIcon={true}
          actions={handlerLink}
          additionalInfo={[
            <ListView.InfoItem key="1">
              <Icon type="fa" name="cube" /> {rAction.instances.length}{' '}
              {rAction.instances.length === 1 ? 'Instance' : 'Instances'}
            </ListView.InfoItem>
          ]}
        >
          <Row>
            <Col xs={12}>
              <Table.PfProvider
                columns={this.columns().columns}
                striped={true}
                bordered={true}
                hover={true}
                dataTable={true}
              >
                <Table.Header headerRows={resolve.headerRows(this.columns())} />
                <Table.Body
                  rows={rAction.instances.map(instance => ({
                    id: instance.name + '.' + instance.template,
                    instanceName: instance.name,
                    instanceTemplate: instance.template,
                    instanceActions: (
                      <Link
                        id={instance.name + '.' + instance.template}
                        to={{
                          pathname: this.getPathname(),
                          search: '?instance=' + instance.name + '.' + instance.template
                        }}
                      >
                        View YAML
                      </Link>
                    )
                  }))}
                  rowKey="id"
                />
              </Table.PfProvider>
            </Col>
          </Row>
        </ListViewItem>
      );
    });
    return instances;
  }

  render() {
    if (this.props.parsedSearch && this.props.parsedSearch.type && this.props.parsedSearch.name) {
      return (
        <div className="container-fluid container-cards-pf">
          <Row className="row-cards-pf">
            <Col>
              <div style={{ float: 'right' }}>
                <Link to={{ pathname: this.getPathname() }}>Back to Rule</Link>{' '}
                <Button onClick={this.props.onRefresh}>
                  <Icon name="refresh" />
                </Button>
              </div>
              <h1>{dicIstioType[this.props.parsedSearch.type] + ': ' + this.props.parsedSearch.name}</h1>
              <AceEditor
                mode="yaml"
                theme="eclipse"
                readOnly={true}
                width={'100%'}
                height={'50vh'}
                className={'istio-ace-editor'}
                setOptions={aceOptions}
                value={this.editorContent(this.props.parsedSearch)}
              />
            </Col>
          </Row>
        </div>
      );
    }
    return (
      <div>
        <Card>
          <CardTitle>
            <strong>Rule: </strong>
            {this.props.rule.name}
          </CardTitle>
          <CardBody>
            <strong>Match: </strong>
            {this.props.rule.match ? this.props.rule.match : '<Empty>'}
            <ListView>{this.renderInstances()}</ListView>
          </CardBody>
        </Card>
      </div>
    );
  }
}

export default IstioRuleInfo;
