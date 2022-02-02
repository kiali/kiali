# Kiali Enhancement Proposal

1. [Summary](#summary)
2. [Motivation](#motivation)
   1. [Goals](#goals)
   2. [Non-Goals](#nongoals)
3. [Solution](#solution)
   1. [Other solutions](#othersolutions)
4. [Roadmap](#roadmap)

# Summary

Establish a process to formally propose large enhancements to the Kiali project. This first KEP (Kiali Enhancement Proposal) also serves as a template for future KEPs.

[github discussion](https://github.com/kiali/kiali/discussions/4208)

# Motivation

The Kiali project relies on github discussions and/or slack to discuss and formalize larger enhancements to the project. This works well for informally discussing a topic however, it is not always clear how or when to transition from a discussion to implementation. In addition, for anyone reading the proposal, understanding and agreeing upon what is being proposed is more difficult in github discussions because ideas and thoughts are spread around multiple threads rather than in a centralized document. Lastly, we also want to preserve changes to the proposal over time as feedback is addressed and the proposal is updated.

## Goals

- Provide a natural way for features to progress from github discussion(s) to an implementable proposal.
- Make it easier to formally present a large enhancement for the project, receive feedback, and reach a consensus on future implementation.
- Versioned and easily searchable proposals.
- Public process.
- Establish owners and a roadmap for the proposal.

## Non-goals

- Impose a strict process for all changes (large or small) to adhere to. The KEP process is meant to enhance the speed at which large features are implemented and improve refinement for those features by making it easier to collaborate on the design of those features before they are implemented. It is not meant to impose a burden on making changes to the project.
- Replace github discussions. It's expected that most large features will first start as an informal discussion which will then lead to a formal proposal.

# Solution

A `design/KEPS` dir is created in the [kiali repo](https://github.com/kiali/kiali) where all KEPS will be submitted and stored.

The KEP process will be as follows:

1. Proposal owner submits a proposal for an enhancement by opening a PR to the Kiali github repo. The PR contains a single markdown file describing the proposal using this KEP as a template. The PR includes any additional materials such as diagrams, pictures, videos etc. Both the proposal and supporting materials are organized under a single directory in the `design/KEPS` section of the kiali repo. As an example, this proposal is submitted under the `design/KEPS/kiali-enhancement-proposal/` directory.
2. Owner assigns `kiali/maintainers` as a reviewer for the PR and assigns themself and any other owners as an `Assignee`.
3. Maintainers provide timely feedback to the proposal in the form of github reviews on the PR.
4. Proposal owners respond to feedback and update proposal by adding commits to the github PR.
5. (Optional) Any pending proposals are discussed and presented during the end of sprint meetings.
6. After feedback has been sufficiently addressed, proposals are either accepted or rejected by Kiali maintainers.
7. Proposal is broken down into epics/issues and implemented. The roadmap for the proposal is updated along the way.

It is expected that both proposal owners and maintainers will be active participants in any open proposals by giving and responding to feedback. Since maintainers have a finite amount of time to spend on reviewing proposals and because one of the main goals of the proposal process is faster progress on enhancements, priority will be given to existing proposals over new proposals so that existing proposals can be implemented or closed.

## Other solutions

- The current method of using primarily using Github discussions to facilitate discussion on formal design proposals.

# Roadmap

- [ ] KEP process proposed and accepted.
