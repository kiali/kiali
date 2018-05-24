import * as React from 'react';
import { Filter } from 'patternfly-react';
import history from '../../app/History';

interface Props {
  dropdownTitle: string;
  resultsTitle: string;
  items: string[];
  onChange: (selected: string[]) => void;
  urlAttrName: string;
}

interface Item {
  name: string;
  selected: boolean;
}

export class ValueSelectHelper {
  items: Item[];
  available: string[];
  selected: string[];
  props: Props;

  constructor(props: Props) {
    this.props = props;

    this.buildItems();
    this.computeState();
  }

  buildItems() {
    // Check whether URL has pre-selection
    let preSelections: string[] = [];
    const urlParams = new URLSearchParams(history.location.search);
    if (urlParams.has(this.props.urlAttrName)) {
      preSelections = urlParams.get(this.props.urlAttrName)!.split(',');
    }

    // Build items
    this.items = this.props.items.map(name => ({ name: name, selected: preSelections.includes(name) }));
  }

  computeState() {
    this.available = this.items.filter(it => !it.selected).map(it => it.name);
    this.selected = this.items.filter(it => it.selected).map(it => it.name);

    // Change URL to match selected filters.
    const urlParams = new URLSearchParams(history.location.search);
    if (this.selected.length === 0) {
      urlParams.delete(this.props.urlAttrName);
    } else {
      urlParams.set(this.props.urlAttrName, this.selected.join(','));
    }
    const newUrlSearch = '?' + urlParams.toString();
    if (newUrlSearch !== history.location.search) {
      history.push(history.location.pathname + newUrlSearch);
    }
  }

  add = (key: string) => {
    const item = this.items.find(it => it.name === key);
    // If item is not found, probably was placeholder click
    if (item) {
      item.selected = true;
      this.computeState();
      this.props.onChange(this.selected);
    }
  };

  remove = (key: string) => {
    const item = this.items.find(it => it.name === key);
    // If item is not found, probably was placeholder click
    if (item) {
      item.selected = false;
      this.computeState();
      this.props.onChange(this.selected);
    }
  };

  clear = () => {
    this.items.forEach(it => (it.selected = false));
    this.computeState();
    this.props.onChange(this.selected);
  };

  renderDropdown() {
    return (
      <Filter>
        <Filter.ValueSelector
          filterValues={this.available}
          placeholder={this.props.dropdownTitle}
          onFilterValueSelected={this.add}
        />
      </Filter>
    );
  }

  hasResults(): boolean {
    return this.selected.length > 0;
  }

  renderResults() {
    return (
      <>
        <Filter.ActiveLabel>{this.props.resultsTitle}</Filter.ActiveLabel>
        <Filter.List>
          {this.selected.map(item => {
            return (
              <Filter.Item key={item} onRemove={this.remove} filterData={item}>
                {item}
              </Filter.Item>
            );
          })}
        </Filter.List>
        <a
          href="#"
          onClick={e => {
            e.preventDefault();
            this.clear();
          }}
        >
          Clear all
        </a>
      </>
    );
  }
}

export default ValueSelectHelper;
