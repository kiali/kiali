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

Before you make a change, please:

- Open a [discussion](https://github.com/kiali/kiali/discussions) or an [issue](https://github.com/kiali/kiali/issues) describing in detail the motivation of work. Regardless of the repo where the work should be done (server, UI, operator, or helm charts), all discussions and issues should be submitted to the main kiali/kiali repo using those links provided.
- Let the maintainers comment on the question or refine the issue.
- Before starting work, make sure maintainers have agreed that the work should be done and has added the issue to the backlog.
- When the design/approach/discussion is ready, prepare a Pull Request with the changes.

### Good first issues

If you are new to contributing to Kiali and want to pick some easier tasks to
get accustomed to the code base, you can pick [issues that are marked _good first issue_
on GitHub](https://github.com/kiali/kiali/labels/good%20first%20issue).

### Developing

The [README for the server](./README.adoc#building) and the [README for the UI](./frontend/README.adoc) have a pretty extensive guide on building Kiali server and UI.

### Internationalization

If you want to add a new language or improve an existing one, you can check the internationalization section of the [README for UI](./frontend/README.adoc#internationalization-i18n)

### Code Style Guide

See the [Style Guide](./STYLE_GUIDE.adoc) about getting your code in style.

### Submitting changes

Once the issue has been agreed upon and developed, you can send a pull-request.

The pull-request should have a detailed explanation of the changes that you are doing (i.e. include screenshots for UI changes).
If you worked on a GitHub issue, please provide the link as part of the description.

Pull requests will be reviewed by the team of committers and they will come up with
suggestions on how to improve the pull-request. You should be prepared to take that
feedback into account, add further commits into the pull-request until the pull-request
is eventually merged.

## License

By contributing your code, you agree to license your contribution under the terms
of the [Apache License](LICENSE).
