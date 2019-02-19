import * as React from 'react';
import { connect } from 'react-redux';
import { Col, Form, Card, FormGroup, FormControl, FieldLevelHelp } from 'patternfly-react';
import { KialiAppState } from '../../store/Store';

interface TagsControlProps {
  fetching: boolean;
  tags: string;
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
          <a href="https://brandur.org/logfmt" target="_blank">
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
    const { fetching, tags } = this.props;
    return (
      <FormGroup style={{ display: 'inline-flex' }}>
        <Col componentClass={Form.ControlLabel}>
          Tags
          <FieldLevelHelp content={this.tagsHelp()} placement={'bottom'} />
        </Col>
        <FormControl
          type="text"
          disabled={fetching}
          defaultValue={tags}
          placeholder={'e.g. http.status_code=200 error=true'}
          style={{ width: '400px', marginLeft: '10px' }}
          onChange={e => this.props.onChange(e)}
        />
      </FormGroup>
    );
  }
}

const mapStateToProps = (state: KialiAppState) => {
  return {
    fetching: state.jaegerState.search.serviceSelected === '',
    tags: state.jaegerState.search.tags
  };
};

const TagsControlContainer = connect(mapStateToProps)(TagsControl);

export default TagsControlContainer;
