# Jenkins Pipeline

* [Directory contents](#directory-contents)
    + [The Pipeline](#the-pipeline)
    + [Support files](#support-files)
    + [Development helper files](#development-helper-files)
    + [README files](#readme-files)
* [Using the Pipeline](#using-the-pipeline)
    + [Automatically determine the release type and build it](#automatically-determine-the-release-type-and-build-it)
    + [Building a minor release](#building-a-minor-release)
    + [Building a patch release](#building-a-patch-release)
    + [Building a patch release (back-end only)](#building-a-patch-release-back-end-only)
    + [Building a major release](#building-a-major-release)
    + [Building a snapshot release](#building-a-snapshot-release)
    + [Building an edge/daily release](#building-an-edgedaily-release)
* [Recovering and troubleshooting a build](#recovering-and-troubleshooting-a-build)
* [Making test builds](#making-test-builds)
* [Developer setup](#developer-setup)
    + [Building the Jenkins image](#building-the-jenkins-image)
    + [Setup Jenkins credentials](#setup-jenkins-credentials)
    + [Re-configure the Pipeline](#re-configure-the-pipeline)

## Directory contents

This directory contains the Jenkins Pipeline used to release
the Kiali project, support files used by the Pipeline during
building, and support files to ease the development of the
Pipeline.

### The Pipeline

The [Jenkinsfile](Jenkinsfile) is the Pipeline. It is written
using [scripted syntax](https://jenkins.io/doc/book/pipeline/syntax/#scripted-pipeline)
which is very similar to the [Groovy language](https://groovy-lang.org/).

The Pipeline is more similar to an orchestrator where build
stages are defined and the actual build implementation
is delegated to Makefiles.

This is the _entrypoint_, so this is the first file you should
check if you want to modify the Pipeline.

### Support files

The [bin/determine-release-type.sh](bin/determine-release-type.sh)
is used to automatically resolve what kind of release needs to be
build, assuming the Pipeline runs weekly. Read the script
to learn more about how it works.

The [bin/jq](https://stedolan.github.io/jq/) v1.6 and
[bin/semver](https://github.com/fsaintjacques/semver-tool) v2.1.0
are tools used to properly set version strings when building releases.

The [Makefile](Makefile) and [Makefile.operator.jenkins](Makefile.operator.jenkins) are repeatedly invoked by the Pipeline. They
are analog and compliment the [Makefile.jenkins](https://github.com/kiali/kiali-ui/blob/master/Makefile.jenkins)
of the kiali-ui repository. These are the files where the build
steps are implemented. 


### Development helper files

These files:

* [bin/entrypoint.sh](bin/entrypoint.sh)
* [Dockerfile](Dockerfile)
* [jenkins_ref/*](jenkins_ref)

are provided to create a container that can be used to test
the Pipeline.

### README files

The [README.md](README.md) file is what you are reading. The files
under the `assets` directory are used in the [README.md](README.md).

## Using the Pipeline

To run the Pipeline, open the _kiali-release_ job by clicking on it.
On the job page, click the _Build with Parameters_ option of the
menu at the left:

![Run Pipeline](assets/jk_pipeline_page_run.png)

A new page asking for Pipeline parameters will appear:

![Pipeline parameters](assets/jk_pipeline_parameters.png)

All parameters have default values and you can run the Pipeline with
these defaults. If needed, change any parameter you need. Then, push
the _Build_ button at the end of the form to run the Pipeline.

As you can see, running the Pipeline is straightforward. The parameters
have a short description to help you know adjust them, if needed.

Since parameters are already described, instead of explaining what
each parameter does, the rest of this section is focused on showing
_by example_ how to run a build of the different Kiali use-cases. 
Unless pointed, it's assumed that you want build the back-end and
the front-end and the operator.

### Automatically determine the release type and build it 

This is achieved by using the default parameter values of the Pipeline. So,
don't worry about the parameters, just click _Build_.

In this mode, the Pipeline will use the date of the system to automatically
determine whether to build a **snapshot**, or to build a **minor** release.
In the current workflow of the project, the _Agile Sprints_ are used to
determine what kind of release to build.

The following image shows what kind of release is chosen to build, given the
current date and the Kiali's Sprint start/end cycle:

![Release diagram](assets/release_diagram.png)
 
### Building a minor release

Set the RELEASE_TYPE parameter of the Pipeline to _minor_ value. This
will publish a minor release of Kiali from the _master_ branches of the
back-end and front-end and operator.

![Minor release param](assets/jk_minor_release_params.png)

**Note:** Remember that minor releases are built automatically. Most
likely, you would need this only for development purposes.

### Building a patch release

First, make sure that all fixes are properly committed to the
repositories (don't change version numbers).

In the current Kiali project workflow, patch releases are built off
from a version branch rather than the `master` branch. Set the Pipeline
parameters as follows:

* RELEASE_TYPE: Use `patch`.
* BACKEND_RELEASING_BRANCH: The branch of the **back-end repository** to
  generate the release from; e.g. `refs/heads/v0.20`.
* UI_RELEASING_BRANCH: The branch of the **front-end repository** to
  generate the release from; e.g. `refs/heads/v0.20`.
* OPERATOR_RELEASING_BRANCH: The branch of the **operator repository** to
  generate the release from; e.g. `refs/heads/v0.20`.
  
### Building a patch release (back-end only)

First, make sure that all fixes are properly committed to the
back-end repository (don't change version numbers).

In the current Kiali project workflow, patch releases are built off
from a version branch rather than the `master` branch.

Set the Pipeline parameters as follows:

* RELEASE_TYPE: Use `patch`.
* BACKEND_RELEASING_BRANCH: The branch of the **back-end repository** to
  generate the release from; e.g. `refs/heads/v0.20`.
* SKIP_UI_RELEASE: Set to `y`.
* SKIP_OPERATOR_RELEASE: Set to `y`.

The front-end that will be bundled in the container image will be the version
specified in the main Makefile
(e.g: https://github.com/kiali/kiali/blob/v0.20.0/Makefile#L16). The front-end
will be downloaded from the NPM registry. If you want to bundle a different
front-end version, use the UI_VERSION parameter; for example.

* UI_VERSION: `0.19.0`

### Building a major release

In the current Kiali project workflow, major releases are built off
from a version branch rather than the `master` branch (similar to patch
releases). Make sure that all code to release is properly committed to the
repositories.

Version numbers must also be pre-setted in the code/version branches.
Example commits of a preparation for a previous major release:

* For the back-end: https://github.com/kiali/kiali/commit/793a577ce6829c62fc8b3c740a42896845c32481#diff-b67911656ef5d18c4ae36cb6741b7965
* For the front-end: https://github.com/kiali/kiali-ui/commit/df41a7077150c242c471c2b3dc2c9d3ec405fb4b#diff-b9cfc7f2cdf78a7f4b91a753d10865a2

Then, run Pipeline with the parameters as follows:

* RELEASE_TYPE: Use `major`.
* BACKEND_RELEASING_BRANCH: The branch of the **back-end repository** to
  generate the release from; e.g. `refs/heads/v1.0`.
* UI_RELEASING_BRANCH: The branch of the **front-end repository** to
  generate the release from; e.g. `refs/heads/v1.0`.
* OPERATOR_RELEASING_BRANCH: The branch of the **operator repository** to
  generate the release from; e.g. `refs/heads/v1.0`.
  
### Building a snapshot release

Set the RELEASE_TYPE parameter of the Pipeline to _snapshot.X_ value, where
`X` is a number; e.g. `snapshot.7`. This will publish a snapshot release of
Kiali from the _master_ branches of the back-end and front-end.

**Note:** Remember that `snapshot.0` and `snapshot.1` releases are built
automatically. Use these ones if the automatic snapshot build failed.
Otherwise, you probably want to use a number greater than `1`.

### Building an edge/daily release

Set the RELEASE_TYPE parameter of the Pipeline to _edge_ value. This will
publish a release of Kiali with `latest` tags from the _master_ branches
of the back-end and front-end and operator.

**Note:** Remember that edge releases are build automatically on each
commit in the master branches of both the back-end and front-end
repositories.

## Recovering and troubleshooting a build

The Pipeline is not idempotent, mainly because of all external systems
that are involved (NPM, repositories, Quay.io, etc.). Nevertheless,
it is possible to re-try a build or do a new build to continue the
failed one. You first need to figure out at what stage the build failed
to decide how to proceed.

Before re-trying anything, check the logs of the failed build. If the
failure was caused by a network issue, you may retry it. Else, most likely
something needs to be fixed manually (code, tests, credentials, etc.).
Fix the cause of the failure and proceed to recover the build.

For `edge` releases, you can just retry the build. Else, pass through the
following checks (in order) to know how to proceed to recover the build. Do
the suggested action of the first check that is not OK:

1. Is the front-end release properly
   [published in NPM](https://www.npmjs.com/package/@kiali/kiali-ui?activeTab=versions)?
   If not:
   * Retry the build. No special handling required.
1. Is the front-end version properly tagged in the repository?
   (see https://github.com/kiali/kiali-ui/tags). If not:
   * Manually create the tag setting the version in package.json
     to the published one.
   * For builds other than snapshots, manually update the package.json file 
     of the master/version branch to prepare it for the next release.
   * Retry the build but set parameters SKIP_UI_RELEASE to `y` and UI_VERSION
     to the version of the front-end that got published in NPM.
1. In the front-end repository, is the package.json correctly updated and
   prepared for the next version? If not:
   * This check does not apply for snapshot builds.
   * Manually update the package.json file of the master/version branch to
     prepare it for the next release.
   * Retry the build but set parameters SKIP_UI_RELEASE to `y` and UI_VERSION
     to the version of the front-end that got published in NPM.
1. Are the container images present in Quay.io?
   Is the back-end version properly tagged (see https://github.com/kiali/kiali/tags)?
   If not to any of these questions:
   * Retry the build but set parameters SKIP_UI_RELEASE to `y` and UI_VERSION
     to the version of the front-end that got published in NPM.
1. Is the back-end release properly created in https://github.com/kiali/kiali/releases?
   * Don't retry the build. 
   * Manually [create the version entry in GitHub](https://github.com/kiali/kiali/releases/new).
   * For builds other than snapshots, manually update the Makefile of
     the back-end repository to prepare it for the next version.
1. In the back-end repository, is the Makefile correctly updated and
   prepared for the next version? If not:
   * For snapshot releases this check doesn't apply.
   * Don't retry the build. Just update the Makefile manually.
1. If all previous checks are OK, then the build failed at a post-build stage.
   Most likely, all is OK and you don't need to retry it.
   
## Making test builds

It is not possible to simulate a build. However, you can run a build
against and affecting alternate repositories.

To run test builds you will need your own forks of the Kiali repositories
and your own Quay.io repository. You will need to
setup Jenkins with a GitHub and Quay.io accounts with push
privileges to your repositories; see the
[Setup Jenkins credentials](#setup-jenkins-credentials) of the developer
setup section to learn more.

When running the build, set the following parameters:

* BACKEND_GITHUB_URI: Use the SSH url of your Kiali's back-end fork; e.g.
  `git@github.com:israel-hdez/swscore.git`.
* UI_GITHUB_URI: Use the SSH url of your Kiali's front-end fork; e.g.
  `git@github.com:israel-hdez/swsui.git`.
* OPERATOR_GITHUB_URI: Use the SSH url of your Kiali operator fork; e.g.
  `git@github.com:israel-hdez/kiali-operator.git`.
* QUAY_NAME: Use your own Quay.io repository for Kiali;
  e.g. `quay.io/edgarhz/kiali`.
* QUAY_OPERATOR_NAME: Use your own Quay.io repository for the operator;
  e.g. `quay.io/edgarhz/kiali-operator`.
* BACKEND_PULL_URI: Use the GitHub API base URL for your back-end fork;
  e.g. `https://api.github.com/repos/israel-hdez/swscore/pulls`.
* UI_PULL_URI: Use the GitHub API base URL for your front-end fork;
  e.g. `https://api.github.com/repos/israel-hdez/swsui/pulls`.
* OPERATOR_PULL_URI: Use the GitHub API base URL for your operator fork;
  e.g. `https://api.github.com/repos/israel-hdez/kiali-operator/pulls`.
* NPM_DRY_RUN: Set to `y`.

Once you run the first test build, if you need to run more test builds,
you may want to use the _Rebuild_ option to avoid setting these
parameters again.

Take into account that the Pipeline can create tags, branches, and commits
on your repositories. Make sure to reset your forks if you are using them
for developing/contributing to Kiali.

## Developer setup

Modifying the Pipeline is easy. You just need a text editor :smile:.
See the [Directory contents](#directory-contents) section to have
some understanding about which files you need to change.

The "hard" part is to test the Pipeline. You need a Jenkins instance
with the tools to correctly build both Kiali's back-end and
front-end and operator, and to deploy Kiali. Instead of going through all the
steps to setup such Jenkins instance, a [preconfigured
Docker image](https://hub.docker.com/r/edgarhz/kiali-jenkins) is
available to start as fast as possible. Run it by invoking:

```
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 8080:8080 \
  edgarhz/kiali-jenkins
```

This command assumes that your Docker daemon's socket is in
`/var/run/docker.sock`. The `-v` parameter is needed because
Kiali is released as a container image, which means that Jenkins
needs access to Docker to build and push the container. Using the
provided command, Jenkins will re-use the Docker instance of
your machine.

Once the container is running, use your browser to access Jenkins
at http://localhost:8080. Username and password are both `admin`.

**Note:** The `edgarhz/kiali-jenkins` image is updated now and then.
So, you may find it is old. But it can work for testing.

The image is preconfigured with two jobs:
* **kiali-release:** It is the Pipeline you will be working with.
* **kiali-release-notifier:** It does nothing. It's there because
  the Pipeline invokes this job. In the real setup, it
  does some QE tasks.

### Building the Jenkins image

In case you prefer to build the Jenkins image, all required files
are provided in the [/deploy/jenkins-ci](/deploy/jenkins-ci)
directory of the repository. Inside that directory, simply run:

`docker build -t kiali-jenkins .`

And run the generated image:

```
docker run \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -p 8080:8080 \
  kiali-jenkins
```

Check the [Dockerfile](Dockerfile) to learn how Jenkins is set up.

### Setup Jenkins credentials

The only thing that is not setup in the preconfigured Jenkins
image are _credentials_. I hope you can guess why :smile:.

Before trying anything, you need to properly setup the credentials.
Once you are logged into Jenkins, click _Credentials_ in the menu
at the left, then click _(global)_ in the page that appears:

![Credentials Home](assets/jk_credentials_home.png)

In the _Global credentials_ page, use the _Add Credentials_ option
at the left to add these five credentials:

* **GitHub SSH keys of the "bot" account**: Used to checkout
  the code to be built, and also to push tags and branches to the
  repositories. For development, you can use an [SSH key
  associated with your GitHub account](https://github.com/settings/keys)
  (it will be safer if you have an account without
  privileges to push to the Kiali repositories.)
  * Kind: SSH Username with private key
  * ID: kiali-bot-gh-ssh
  * Username: whatever you want
  * Private key: A valid SSH private key for GitHub
* **GitHub token of the "bot" account**: Used to make calls to
  the [GitHub REST API](https://developer.github.com/v3/). For
  development, you can use a [GitHub Personal access token](https://github.com/settings/tokens).
  This token and the SSH keys of the previous bullet should
  be associated to the same GitHub account. 
  * Kind: Secret text
  * ID: kiali-bot-gh-token
  * Secret: A valid GitHub token
* **NPM token**: Used to push the front-end release to NPM. For
  development, use any arbitrary string.
  * Kind: Secret text
  * ID: kiali-npm
  * Secret: An arbitrary string.
* **Quay credentials:** Used to push the Kiali image and the
  Kiali operator image to Quay.io. For development, use your
  Quay.io account (it will be safer if you use an account
  without push rights to the Quay Kiali repositories.)
  * Kind: Username with password
  * ID: kiali-quay
  * Username: A valid Quay.io username
  * Password: A valid Quay.io password
  
Once you finish setting up credentials, the list should look similar
to the following image and you are ready to start builds:

![Configured credentials](assets/jk_credentials_list.png)

Please, read the [Making test builds](#making-test-builds) section
before running your first build.

### Re-configure the Pipeline

This step is optional. The preconfigured job will fetch and use the
[Jenkinsfile](Jenkinsfile) from the `master` branch of the Kiali
back-end repository. So, if you are going to change the
[Jenkinsfile](Jenkinsfile), you need to change this configuration.
Else, skip this section.

On the Jenkins home page, place your mouse pointer over the
_kiali-release_ job. Press the little arrow that appears next to
the job name and select _Configure_ in the menu:

![Configure menu](assets/jk_configure_menu.png)

In the configuration page, select the _Pipeline_ tab to scroll
down to see the form to change:

![Pipeline configuration](assets/jk_pipeline_tab_config.png)

You have two options to re-configure:

1. You can change the _Definition_ dropdown to _Pipeline script_ .
   The form will be replaced with an editor. Just paste the edited
   _Jenkinsfile_. Then, save the Pipeline and trigger a build to test
   your changes.
1. Change the _Repository URL_ and the _Branch Specifier_ to
   point to the place where you are pushing your changes. Then,
   save the Pipeline and trigger a build to test your changes.
   
First option is better if you are only changing the [Jenkinsfile](Jenkinsfile).
If you also need to change other support files, you can use either.
