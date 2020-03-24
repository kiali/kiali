import * as React from 'react';
import { shallow, ShallowWrapper } from 'enzyme';
import ServiceLink from '../ServiceLink';
import { ServiceIcon } from '@patternfly/react-icons';
import { Link } from 'react-router-dom';

const serviceLink = (ns: string, host: string, isValid: boolean) => {
  return shallow(<ServiceLink namespace={ns} host={host} isValid={isValid} />);
};

const testLink = (wrapper: any, url: string, host: string) => {
  // Get the link component
  const link = wrapper.find(Link).first();

  // There is a link
  expect(link).toBeDefined();

  // Inspect the link
  const linkProps = link.props();
  expect(linkProps.to).toBe(url);

  // Inspect host and icon presence
  expect(link.find(ServiceIcon)).toBeDefined();
  expect(link.contains(host));
};

const testPlain = (wrapper: ShallowWrapper, host: string) => {
  expect(wrapper.text()).toBe(host);
};

describe('SerivceLink component', () => {
  describe('when is FQDN', () => {
    it('should render link', () => {
      let wrapper = serviceLink('bookinfo', 'reviews.bookinfo.svc.cluster.local', true);
      testLink(wrapper, '/namespaces/bookinfo/services/reviews', 'reviews.bookinfo.svc.cluster.local');

      // It keeps FQDN namespace
      wrapper = serviceLink('bookinfo', 'reviews.default.svc.cluster.local', true);
      testLink(wrapper, '/namespaces/default/services/reviews', 'reviews.default.svc.cluster.local');
    });

    it('if is not valid, should render plain text', () => {
      const wrapper = serviceLink('bookinfo', 'reviews.bookinfo.svc.cluster.local', false);
      testPlain(wrapper, 'reviews.bookinfo.svc.cluster.local');
    });

    it('and has wildcard, it should render a link', () => {
      let wrapper = serviceLink('bookinfo', '*.bookinfo.svc.cluster.local', true);
      testPlain(wrapper, '*.bookinfo.svc.cluster.local');
    });
  });

  describe('when is shortname', () => {
    it('should render link', () => {
      const wrapper = serviceLink('bookinfo', 'reviews', true);
      testLink(wrapper, '/namespaces/bookinfo/services/reviews', 'reviews');
    });

    it('if is not valid, should render plain text', () => {
      const wrapper = serviceLink('bookinfo', 'reviews', false);
      testPlain(wrapper, 'reviews');
    });
  });

  describe('when is svc.namespace format', () => {
    it('should render link', () => {
      let wrapper = serviceLink('bookinfo', 'reviews.bookinfo', true);
      testLink(wrapper, '/namespaces/bookinfo/services/reviews', 'reviews');

      wrapper = serviceLink('bookinfo', 'reviews.default', true);
      testPlain(wrapper, 'reviews.default');
    });

    it('if is not valid, should render plain text', () => {
      const wrapper = serviceLink('bookinfo', 'reviews.bookinfo', false);
      testPlain(wrapper, 'reviews.bookinfo');
    });
  });

  describe('when host is empty', () => {
    it('should render a hyphen, not linked', () => {
      const wrapper = serviceLink('bookinfo', '', true);
      testPlain(wrapper, '-');
    });

    it('when invalid, should render a hyphen, not linked', () => {
      const wrapper = serviceLink('bookinfo', '', true);
      testPlain(wrapper, '-');
    });
  });

  describe('when host is a service entry', () => {
    it('should render a the service in plain', () => {
      let wrapper = serviceLink('bookinfo', 'kiali.io', true);
      testPlain(wrapper, 'kiali.io');

      wrapper = serviceLink('bookinfo', 'books.bookinfo.hello.com', true);
      testPlain(wrapper, 'books.bookinfo.hello.com');

      wrapper = serviceLink('bookinfo', '*.hello.com', true);
      testPlain(wrapper, '*.hello.com');
    });

    it('when invalid, should render a hyphen, not linked', () => {
      let wrapper = serviceLink('bookinfo', 'kiali.io', false);
      testPlain(wrapper, 'kiali.io');
    });
  });

  describe('when is *.local', () => {
    it("shouldn't render link", () => {
      let wrapper = serviceLink('bookinfo', '*.local', true);
      testPlain(wrapper, '*.local');
    });
  });
});
