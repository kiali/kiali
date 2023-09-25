// Authentication

import { authenticationConfig } from './AuthenticationConfig';
// Configuration

import { config } from './Config';

// Icons
import { icons } from './Icons';

// Logos
import kialiLogoLight from '../assets/img/logo-lightbkg.svg';
import kialiLogoDark from '../assets/img/logo-darkbkg.svg';
import kialiIconLight from '../assets/img/icon-lightbkg.svg';
import kialiIconDark from '../assets/img/icon-darkbkg.svg';

// Paths
import { Paths } from './Paths';

// Jaeger Query
import { jaegerQuery } from './JaegerQuery';

// ServerConfig
import { homeCluster, isMultiCluster, serverConfig } from './ServerConfig';

export {
  authenticationConfig,
  config,
  Paths,
  icons,
  homeCluster,
  isMultiCluster,
  kialiLogoLight,
  kialiLogoDark,
  kialiIconLight,
  kialiIconDark,
  serverConfig,
  jaegerQuery
};
