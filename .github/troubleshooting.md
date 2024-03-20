# Troubleshooting Kiali release pipelines

The project Kiali has four release pipelines mentioned in the release document. These pipelines have similarities but also some differences. For this reason, there will be common things to look at in case of errors but also some different things and actions to take according to each pipeline.

An important step to check for all of the pipelines is the initialize job, specifically the "Log information" step. The following is an example of a release execution, where the inputs are logged to help troubleshooting. It indicates the inputs that will make the pipeline behave accordingly.

* Release type: minor
* Release version: v1.54.0
* Next version: v1.55.0
* Branch version: v1.54
* Quay tag: quay.io/kiali/kiali:v1.54.0 quay.io/kiali/kiali:v1.54

With this information, the person troubleshooting would know the type of release (is a minor, a patch?), the release version, the next version and also the tags for pushing the images.

## Kiali Server and Kiali operator

The Kiali server pipeline has jobs to build the backend, the frontend, test both of them and also jobs to run integration tests on both too. The jobs are:

* build_backend
* build_frontend
* integration_tests_backend
* integration_tests_frontend

If some error occurs in these jobs, there is nothing to amend or fix. The errors can occur because of a failure test, a transient situation with the integration tests or some problem in GitHub infrastructure. 

The Kiali server and Kiali operator shares a very similar last job, the one that makes the release, called "release", where the release versions are set in the code, the images are built and pushed, the tag is pushed, the release is created, the preparation for the next version is made and if this is a minor release, a PR is generated targeting master to update the versions with the next ones.

In case of errors in any of these steps, the log should be inspected to 
check what was the last action the pipeline executed. The pipelines are not idempotent so to retry them if there was a failure in the release step, manual amends should be done to prepare the next run:

* Delete the tags and the release on GitHub (if exists)


## Helm charts

The Helm charts pipeline has a "release" job that in case of errors, the log should be inspected to check what was the last action the pipeline executed.

The manual actions to do in case of a failure are:

* Delete the $RELEASE_VERSION-main branch (if exists)

* Delete the tags $RELEASE_VERSION and $RELEASE_VERSION-master (if exist)
* Delete the PR generated (if exists)

## Kiali.io

The Kiali.io pipeline has a "release" job that in case of errors, the log should be inspected to check what was the last action the pipeline executed.

The manual actions to do in case of a failure are:

* Delete the $RELEASE_VERSION branch (if exists)


