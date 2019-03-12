import * as React from 'react';
import { Col, Form, Card, FormGroup, FormControl, FieldLevelHelp } from 'patternfly-react';

interface TagsControlProps {
  disable?: boolean;
  tags?: string;
  onChange: (event: any) => void;
}

export class TagsControl extends React.PureComponent<TagsControlProps, {}> {
  constructor(props: TagsControlProps) {
    super(props);
  }

  tagsHelp = () => {
    return (
      <Card>
        <Card.Title>
          Values should be in the{' '}
          <a rel="noopener noreferrer" href="https://brandur.org/logfmt" target="_blank">
            logfmt
          </a>{' '}
          format.
        </Card.Title>
        <Card.Body>
          <ul>
            <li>Use space for conjunctions</li>
            <li>Values containing whitespace should be enclosed in quotes</li>
          </ul>
        </Card.Body>
        <Card.Footer>
          <code>error=true db.statement="select * from User"</code>
        </Card.Footer>
      </Card>
    );
  };

  render() {
    const { disable, tags } = this.props;
    return (
      <FormGroup style={{ display: 'inline-flex', marginLeft: '-20px' }}>
        <Col componentClass={Form.ControlLabel}>
          Tags
          <FieldLevelHelp content={this.tagsHelp()} placement={'bottom'} />
        </Col>
        <FormControl
          type="text"
          disabled={disable}
          defaultValue={tags}
          placeholder={'e.g. http.status_code=200 error=true'}
          style={{ width: '400px', marginLeft: '10px' }}
          onChange={e => this.props.onChange(e)}
        />
      </FormGroup>
    );
  }
}

export default TagsControl;
