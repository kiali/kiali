import * as React from 'react';
import { shallow } from 'enzyme';
import Badge from '../../../../components/Badge/Badge';
import PfInfoCard from '../../../../components/Pf/PfInfoCard';

const CardContent = (
  <div key="pod">
    <div>
      <strong>Pod:</strong>
    </div>
    <ul style={{ listStyleType: 'none' }}>
      <li key="pod_labels_badge_">
        <Badge scale={0.8} style="plastic" color="green" leftText="my_key" rightText="my_value" />
      </li>
    </ul>
  </div>
);

describe('#PfInfoCard render correctly with data', () => {
  it('should render service card', () => {
    const wrapper = shallow(<PfInfoCard iconType="fa" iconName="cube" title="Pods" items={CardContent} />);
    expect(wrapper).toBeDefined();
    expect(wrapper).toMatchSnapshot();
  });
});
