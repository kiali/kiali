// References when creating this script:
// * https://github.com/samrocketman/jenkins-bootstrap-shared/tree/master/scripts
// * https://github.com/rgoodwin/jenkins-master-preconfigured
// * https://nickcharlton.net/posts/setting-jenkins-credentials-with-groovy.html

import com.cloudbees.plugins.credentials.CredentialsScope
import com.cloudbees.plugins.credentials.domains.Domain
import com.cloudbees.plugins.credentials.impl.UsernamePasswordCredentialsImpl
import com.cloudbees.jenkins.plugins.sshcredentials.impl.BasicSSHUserPrivateKey
import hudson.security.csrf.DefaultCrumbIssuer
import hudson.security.*
import hudson.util.Secret
import jenkins.model.*
import org.jenkinsci.plugins.plaincredentials.impl.StringCredentialsImpl


def hudsonRealm = new HudsonPrivateSecurityRealm(false)
hudsonRealm.createAccount('admin', 'admin')

def authorizationStrategy = new FullControlOnceLoggedInAuthorizationStrategy()
authorizationStrategy.setAllowAnonymousRead(false)

def instance = Jenkins.get()
JenkinsLocationConfiguration location = instance.getExtensionList('jenkins.model.JenkinsLocationConfiguration')[0]

location.url = 'http://localhost:8080'
instance.getExtensionList(jenkins.security.s2m.MasterKillSwitchWarning.class)[0].disable(true)
instance.setAuthorizationStrategy(authorizationStrategy)
instance.setCrumbIssuer(new DefaultCrumbIssuer(true))
instance.setLabelString('kiali-build fedora')
instance.setSecurityRealm(hudsonRealm)

instance.save()

// Create secrets, if environment variables are set
def domain = Domain.global()
def store = instance.getExtensionList("com.cloudbees.plugins.credentials.SystemCredentialsProvider")[0].getStore()

def npmSecret = new StringCredentialsImpl(
    CredentialsScope.GLOBAL,
    "kiali-npm",
    "NPM token: Used to push the front-end release to NPM. For development, use any arbitrary string.",
    Secret.fromString(org.apache.commons.lang.RandomStringUtils.random(10, true, true))
)
store.addCredentials(domain, npmSecret)

if (System.getenv('BOT_TOKEN') != null) {
    def botSecret = new StringCredentialsImpl(
        CredentialsScope.GLOBAL,
        "kiali-bot-gh-token",
        "GitHub token of the BOT account. Used to make calls to the GitHub REST API. For development, you can use a GitHub Personal access token. This token and the SSH keys of the previous bullet should be associated to the same GitHub account.",
        Secret.fromString(System.getenv('BOT_TOKEN'))
    )
    store.addCredentials(domain, botSecret)
}

if (System.getenv('QUAY_USERNAME') != null && System.getenv('QUAY_PASSWORD') != null) {
    def quaySecret = new UsernamePasswordCredentialsImpl(
        CredentialsScope.GLOBAL,
        "kiali-quay",
        "Quay credentials: Used to push the Kiali image and the Kiali operator image to Quay.io. For development, use your Quay.io account (it will be safer if you use an account without push rights to the Quay Kiali repositories.)",
        System.getenv('QUAY_USERNAME'),
        System.getenv('QUAY_PASSWORD')
    )

    store.addCredentials(domain, quaySecret)
}

if (System.getenv('BOT_SSH_KEY') != null) {
    def botSshKey = new BasicSSHUserPrivateKey.DirectEntryPrivateKeySource(System.getenv('BOT_SSH_KEY'))
    def botSshSecret = new BasicSSHUserPrivateKey(
        CredentialsScope.GLOBAL,
        "kiali-bot-gh-ssh",
        "foo",
        botSshKey,
        "",
        "GitHub SSH keys of the BOT account: Used to checkout the code to be built, and also to push tags and branches to the repositories. For development, you can use an SSH key associated with your GitHub account (it will be safer if you have an account without privileges to push to the Kiali repositories.)"
    )

    store.addCredentials(domain, botSshSecret)
}