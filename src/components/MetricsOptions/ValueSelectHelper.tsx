import * as React from 'react';
import { Filter } from 'patternfly-react';

interface Props {
  dropdownTitle: string;
  resultsTitle: string;
  items: string[];
  onChange: (selected: string[]) => void;
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
    this.add = this.add.bind(this);
    this.remove = this.remove.bind(this);
    this.clear = this.clear.bind(this);

    this.items = props.items.map(name => ({ name: name, selected: false }));
    this.computeState();
  }

  computeState() {
    this.available = this.items.filter(it => !it.selected).map(it => it.name);
    this.selected = this.items.filter(it => it.selected).map(it => it.name);
  }

  add(key: string) {
    const item = this.items.find(it => it.name === key);
    // If item is not found, probably was placeholder click
    if (item) {
      item.selected = true;
      this.computeState();
      this.props.onChange(this.selected);
    }
  }

  remove(key: string) {
    const item = this.items.find(it => it.name === key);
    // If item is not found, probably was placeholder click
    if (item) {
      item.selected = false;
      this.computeState();
      this.props.onChange(this.selected);
    }
  }

  clear() {
    this.items.forEach(it => (it.selected = false));
    this.computeState();
    this.props.onChange(this.selected);
  }

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
