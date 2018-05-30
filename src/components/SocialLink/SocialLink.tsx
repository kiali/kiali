import * as React from 'react';
import { Icon } from 'patternfly-react';
import { socialLinks } from '../../config';

class SocialLink extends React.Component {
  render() {
    return (
      <ul className={'login-pf-page-footer-links list-unstyled'}>
        {socialLinks.map(socialMedia => (
          <li key={socialMedia.icon.name}>
            <a className={'login-pf-page-footer-link'} href={socialMedia.url} target="_blank">
              <Icon type={socialMedia.icon.type} name={socialMedia.icon.name} /> {socialMedia.label}
            </a>
          </li>
        ))}
      </ul>
    );
  }
}

export default SocialLink;
