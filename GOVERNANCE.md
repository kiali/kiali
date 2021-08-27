# Kiali Governance

This document defines governance policies for the Kiali project.

## Maintainers

Kiali Maintainers have write access to the [https://github.com/kiali](Kiali GitHub repositories).
They can merge their own patches or patches from others. Maintainers collectively manage the project's
resources and contributors.

This privilege is granted with an expectation of responsibility: maintainers care about the Kiali project and want to help it grow and improve. Above the ability to contribute changes, a maintainer has demonstrated the ability to collaborate well with the team, assign appropriate code reviewers, contribute high-quality code, and be thorough and timely with fixes, tests and documentation.

A maintainer is a contributor to the Kiali project's success and a citizen helping the project succeed.

Current list of maintainers (alphabetically ordered):

* [abonas](https://github.com/abonas)
* [aljesusg](https://github.com/aljesusg)
* [hhovsepy](https://github.com/hhovsepy)
* [israel-hdez](https://github.com/israel-hdez)
* [jmazzitelli](https://github.com/jmazzitelli)
* [leandroberetta](https://github.com/leandroberetta)
* [nrfox](https://github.com/nrfox)
* [xeviknal](https://github.com/xeviknal)

### Becoming a Maintainer

To become a Maintainer you need to demonstrate the following:

* commitment to the project
  * participate in discussions, contributions, code reviews for 3 months or more,
  * perform code reviews for 10 non-trivial pull requests,
  * contribute 10 non-trivial pull requests and have them merged,
* ability to write high quality code and/or documentation,
* ability to collaborate with the team,
* understanding of team policies and processes,
* understanding of the project's code base, and coding and documentation style.

A new maintainer must be proposed by an existing maintainer by opening a [GitHub
discussion](https://github.com/kiali/kiali/discussions/new) under the Governance category.
The following information must be provided:

* nominee's GitHub user name,
* an explanation of why the nominee should be a maintainer,
* a list of links to non-trivial pull requests (top 10) authored by the nominee.

Two other maintainers need to second the nomination. If no one objects in 5 working days (U.S.), the nomination is accepted.  If anyone objects or wants more information, the maintainers discuss and usually come to a consensus (within the 5 working days). If issues can't be resolved, there's a simple majority vote among current maintainers.

## Testers

Kiali testers dedicate time and resources to ensure that the Kiali project is
delivered with good quality, by actively trying pull requests to find bugs,
performance issues and any other kind of issues. Testers may also write manual or
automated tests. The focus is on "System testing" and "Integration testing",
although it is possible to do simple sanity, smoke and regression testing, or
simply running existent automated tests if that is enough for a certain pull request.

Testers do not need to be Maintainers. Also, Maintainers do not need to be Testers. Yet,
both roles aren't mutually exclusive.

Current list of testers (alphabetically ordered):

* [mattmahoneyrh](https://github.com/mattmahoneyrh)
* [pbajjuri20](https://github.com/pbajjuri20)
* [prachiyadav](https://github.com/prachiyadav)
* [skondkar](https://github.com/skondkar)

### Becoming a Tester

To become a Tester you need to:

* actively participate in testing code changes of the Kiali project
  * testing pull requests for 3 months or more,
  * find 5 non trivial issues in Kiali,
  * occassionally, do testing over `master` branches to find broken features
* ability to collaborate with the team,
* ability to document testing procedures of Kiali features and to update existing documentation if features change,
* understanding of team policies and processes.

## Leaders

Kiali leaders are Maintainers who have a broad knowledge about the Kiali project, its goals and vision.
They may also be aware on how the ecosystem related to Kiali is evolving, and may also be aware of related projects.
Thus, they are able to guide and mentor other Maintainers, give direction, and set priorities to the Kiali project.

Current list of leaders (alphabetically ordered):

* [jshaughn](https://github.com/jshaughn)
* [lucasponce](https://github.com/lucasponce)

### Becoming a Leader

To become a Leader, you must first be a Maintainer. Then, a new Leader must be proposed
by an existing Maintainer by opening a [GitHub discussion](https://github.com/kiali/kiali/discussions/new)
under the Governance category. The following information must be provided:

* nominee's GitHub user name,
* an explanation of why the nominee should be a leader.

Two other maintainers need to second the nomination. If no one objects in 5 working days (U.S.), the nomination is accepted.  If anyone objects or wants more information, the maintainers discuss and usually come to a consensus (within the 5 working days). If issues can't be resolved, there's a simple majority vote among current maintainers.

## Inactivity

It is important for contributors to be and stay active to set an example and show commitment to the project. Inactivity is harmful to the project as it may lead to unexpected delays, contributor attrition, and a lost of trust in the project.

* Inactivity is measured by:
    * Periods of no contributions for longer than 4 months
    * Periods of no communication for longer than 4 months
* Consequences of being inactive include:
    * Involuntary removal or demotion
    * Being asked to move to Emeritus status

## Involuntary Removal or Demotion

Involuntary removal/demotion of a contributor happens when requirements to be on certain role aren't being met. This may include repeated patterns of inactivity, extended period of inactivity, a period of failing to meet the requirements of your role, and/or a violation of the Code of Conduct. This process is important because it protects the community and its deliverables while also opens up opportunities for new contributors to step in.

<!-- TODO: replace with your method of removing/demoting contributors.  If you have a formal governance structure, this would be a good place to assign this to your governance, such as a Steering Committee.
Again, the example below is for a project without formal governance except the maintainers.-->
Involuntary removal or demotion is handled through a vote by simple majority of the current Maintainers.

## Stepping Down/Emeritus Process

If and when contributors' commitment levels change, contributors can consider stepping down (moving down the contributor ladder) vs moving to emeritus status (completely stepping away from the project).

Contact the Maintainers about changing to Emeritus status, or reducing your contributor level.

## Voting

While most business in Kiali project is conducted by "lazy consensus", periodically
the Maintainers may need to vote on specific actions or changes.
A vote can be taken on [the developer mailing list](TODO) or
[the private Maintainer mailing list](TODO) for security or conduct matters.  
Votes may also be taken at [the developer meeting](TODO).  Any Maintainer may
demand a vote be taken.

Most votes require a simple majority of all Maintainers to succeed. Maintainers
can be removed by a 2/3 majority vote of all Maintainers, or by resignation. Changes
to the Governance require a 2/3 vote of all Maintainers.

## Other Changes

Unless specified above, all other changes to the project require a 2/3 majority vote by maintainers.
Additionally, any maintainer may request that any change require a 2/3 majority vote by maintainers.
