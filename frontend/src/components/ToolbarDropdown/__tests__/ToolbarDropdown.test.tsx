import * as React from 'react';
import { shallow } from 'enzyme';
import { shallowToJson } from 'enzyme-to-json';

import { ToolbarDropdown } from '../ToolbarDropdown';
import { config } from '../../../config';
import { serverConfig } from '../../../config/ServerConfig';

const data = [
  {
    id: 'graph_filter_interval_duration',
    default: config.toolbar.defaultDuration,
    options: serverConfig.durations
  },
  {
    id: 'metrics_filter_poll_interval',
    default: config.toolbar.defaultRefreshInterval,
    options: config.toolbar.refreshInterval
  },
  { id: 'graph_filter_layouts', default: 'cola', options: config.toolbar.graphLayouts }
];

describe('ToolbarDropdown', () => {
  it('Render correctly the toolbar dropdown', () => {
    data.forEach(dropdownType => {
      const wrapper = shallow(
        <ToolbarDropdown
          id={dropdownType.id}
          disabled={false}
          handleSelect={jest.fn()}
          nameDropdown={dropdownType.id}
          value={dropdownType.default}
          label={dropdownType.options[dropdownType.default]}
          options={dropdownType.options}
        />
      );
      expect(shallowToJson(wrapper)).toMatchSnapshot();
    });
  });
});
