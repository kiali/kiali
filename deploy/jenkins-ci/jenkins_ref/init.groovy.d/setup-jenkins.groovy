// References when creating this script:
// * https://github.com/samrocketman/jenkins-bootstrap-shared/tree/master/scripts
// * https://github.com/rgoodwin/jenkins-master-preconfigured

import hudson.security.csrf.DefaultCrumbIssuer
import jenkins.model.*
import hudson.security.*

def hudsonRealm = new HudsonPrivateSecurityRealm(false)
hudsonRealm.createAccount('admin', 'admin')

def authorizationStrategy = new FullControlOnceLoggedInAuthorizationStrategy()
authorizationStrategy.setAllowAnonymousRead(false)

JenkinsLocationConfiguration location = Jenkins.instance.getExtensionList('jenkins.model.JenkinsLocationConfiguration')[0]

location.url = 'http://localhost:8080'
Jenkins.instance.getExtensionList(jenkins.security.s2m.MasterKillSwitchWarning.class)[0].disable(true)
Jenkins.instance.setAuthorizationStrategy(authorizationStrategy)
Jenkins.instance.setCrumbIssuer(new DefaultCrumbIssuer(true))
Jenkins.instance.setLabelString('kiali-build')
Jenkins.instance.setSecurityRealm(hudsonRealm)

Jenkins.instance.save()
