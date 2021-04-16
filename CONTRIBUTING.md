# How to contribute to Kiali

We'd love your help!

Kiali is [Apache 2.0 licensed](LICENSE) and accepts contributions via GitHub
pull requests. 
Kiali does not require any contributor agreement to submit patches.

This document outlines some of the conventions on development
workflow, commit message formatting, contact points and other resources to make
it easier to get your contribution accepted.

We gratefully welcome improvements to documentation as well as to code.



## Making a change

The Kiali code base is split into several repositories. For the application these
are:

* Kiali : server part, written in Golang
* Kiali-UI : UI part, written in Typescript, using the React framework.

Bug tracking happens centrally for both repositories.
Before you make a change, please [open an issue in GitHub](https://github.com/kiali/kiali/issues/new/choose). 

### Good first issues

If you are new to contributing to Kiali and want to pick some easier tasks to 
get accustomed to the code base, you can pick [issues that are marked _good first issue_
on GitHub](https://github.com/kiali/kiali/labels/good%20first%20issue).

### Discussing changes

For large changes it is probably good to first discuss them on the [Kiali-dev](https://groups.google.com/forum/#!forum/kiali-dev) mailing list.

### Developing

The [README for the server](./README.adoc#building) and the [README for the UI](https://github.com/kiali/kiali-ui#developing) have a pretty exhausting guide on building Kiali server and UI. 

### Code Style Guide

See the [Backend Style Guide](./STYLE_GUIDE.adoc) and the [Frontend Style Guide](https://github.com/kiali/kiali-ui/blob/master/STYLE_GUIDE.adoc) about getting your code in style.


### Submitting changes

Once the issue has been agreed upon and developed, you can send a pull-request. 

The pull-request should have a detailed explanation of the changes that you are doing.
If you worked on a GitHub issue, please provide the link as part of the description.

If your changes have impact on the front-end, an image showing the changed screen will be
very helpful to understand your changes. If possible, provide a screenshot before the change
and another one after the change. 

The pull-request template will help you here.

Pull requests will be reviewed by the team of committers and they will come up with 
suggestions on how to improve the pull-request. You should be prepared to take that
feedback into account, add further commits into the pull-request until the pull-request
is eventually merged.

## License

By contributing your code, you agree to license your contribution under the terms
of the [Apache License](LICENSE).
