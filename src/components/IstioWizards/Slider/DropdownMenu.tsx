// Clone of Slider component to workaround issue https://github.com/patternfly/patternfly-react/issues/1221

import React from 'react';
import { Dropdown, MenuItem } from 'patternfly-react';

type Props = {
  dropup: boolean;
  dropdownList: string[];
  onFormatChange: (event: string) => void;
  title: string;
};

class DropdownMenu extends React.Component<Props> {
  static defaultProps = {
    dropup: false,
    dropdownList: null,
    onFormatChange: null,
    title: null
  };

  render() {
    const { dropup, dropdownList, onFormatChange, title } = this.props;
    const menuItems = dropdownList.map((item, index) => (
      <MenuItem bsClass="slider_menuitem" onClick={event => onFormatChange(event.target.text)} key={index} value={item}>
        {item}
      </MenuItem>
    ));

    return (
      <Dropdown id="slider_dropdown" dropup={dropup} pullRight={true}>
        <Dropdown.Toggle>
          <span>{title || dropdownList[0]}</span>
        </Dropdown.Toggle>
        <Dropdown.Menu>{menuItems}</Dropdown.Menu>
      </Dropdown>
    );
  }
}

export default DropdownMenu;
