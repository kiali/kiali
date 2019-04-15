import * as React from 'react';
import {
  BasicLoginCardLayout,
  BasicLoginPageLayout,
  Icon,
  LoginCard,
  LoginCardHeader,
  LoginPageContainer,
  LoginPageFooter,
  LoginPageHeader,
  Spinner
} from 'patternfly-react';
import { isKioskMode } from '../utils/SearchParamUtils';

const kialiTitle = require('../assets/img/logo-login.svg');

const InitializingScreen: React.FC<{ errorMsg?: string }> = (props: { errorMsg?: string }) => {
  if (document.documentElement) {
    document.documentElement.className = isKioskMode() ? 'kiosk' : '';
  }

  return (
    <LoginPageContainer style={{ backgroundImage: 'none' }}>
      <BasicLoginPageLayout>
        <LoginPageHeader logoSrc={kialiTitle} />
        <BasicLoginCardLayout>
          <LoginCard>
            <LoginCardHeader>
              {props.errorMsg ? (
                <div>
                  <Icon type="pf" name="error-circle-o" /> {props.errorMsg}
                </div>
              ) : (
                <>
                  <Spinner loading={true} />
                  <h1>Initializing...</h1>
                </>
              )}
            </LoginCardHeader>
          </LoginCard>
          <LoginPageFooter />
        </BasicLoginCardLayout>
      </BasicLoginPageLayout>
    </LoginPageContainer>
  );
};

export default InitializingScreen;
