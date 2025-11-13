# Kiali Project AI Policy

## Table of Contents

- [Purpose](#purpose)
- [Scope](#scope)
- [Core Principles](#core-principles)
- [Guidelines for AI-Assisted Contributions](#guidelines-for-ai-assisted-contributions)
  - [Permitted Uses](#permitted-uses)
  - [Required Practices](#required-practices)
  - [Quality Standards](#quality-standards)
- [Community and Project Health](#community-and-project-health)
  - [For New Contributors](#for-new-contributors)
  - [For Project Maintainers](#for-project-maintainers)
- [Prohibited Practices](#prohibited-practices)
- [Documentation and AI-Generated Content](#documentation-and-ai-generated-content)
  - [Technical Documentation](#technical-documentation)
  - [Design Documents and RFCs](#design-documents-and-rfcs)
  - [AI-Generated Images and Media](#ai-generated-images-and-media)
- [Project-Specific Considerations](#project-specific-considerations)
  - [For Kiali Console (UI/Frontend)](#for-kiali-console-uifrontend)
  - [For Kiali Server (Backend)](#for-kiali-server-backend)
  - [For Kiali Operator](#for-kiali-operator)
- [Compliance with Employer Policies](#compliance-with-employer-policies)
- [Questions and Concerns](#questions-and-concerns)
- [References](#references)
- [Acknowledgments](#acknowledgments)

## Purpose

This AI Policy establishes guidelines for the use of Artificial Intelligence (AI) and Machine Learning (ML) tools in the development, documentation, and maintenance of the Kiali project. As a CNCF-aligned project in the Istio service mesh ecosystem, Kiali is committed to maintaining high standards of code quality, community engagement, and open source principles while embracing responsible innovation.

This policy is aligned with the [Linux Foundation's Generative AI Policy](https://www.linuxfoundation.org/legal/generative-ai) and [CNCF guidelines for AI-assisted open source projects](https://github.com/cncf/toc/issues/1803).

This policy should be read in conjunction with the Kiali project's [CONTRIBUTING.md](./CONTRIBUTING.md), [STYLE_GUIDE.adoc](./STYLE_GUIDE.adoc), and [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md).

## Scope

This policy applies to:
- All Kiali organization repositories and projects
- Code contributions (including features, bug fixes, and refactoring)
- Documentation and technical writing
- Configuration files, scripts, and automation
- Test code and test data
- Community contributions and pull requests

## Core Principles

1. **Human Accountability**
- All contributions must be reviewed, understood, and validated by human contributors
- Contributors remain fully responsible for the quality, security, and correctness of submitted code, regardless of how it was created
- AI tools are assistants, not replacements for human judgment and expertise

2. **Open Source Values**
- Contributions must align with [Kiali's open source license](./LICENSE)
- Maintain transparency in development practices
- Foster genuine community collaboration and knowledge sharing
- Uphold the Code of Conduct and community values

3. **Quality and Security**
- All code must meet Kiali's quality standards and pass required reviews
- Security considerations take precedence over development speed
- Comprehensive testing is required regardless of development method

## Guidelines for AI-Assisted Contributions

### Permitted Uses

AI and ML tools (including but not limited to GitHub Copilot, ChatGPT, Claude, Cursor, and similar tools) may be used to assist with:

1. **Code Development**
   - Generating boilerplate code and common patterns
   - Suggesting implementations for well-defined tasks
   - Refactoring existing code
   - Writing unit tests and test cases

2. **Documentation**
   - Drafting technical documentation
   - Improving clarity and grammar
   - Generating API documentation templates
   - Creating examples and tutorials

3. **Code Review and Analysis**
   - Identifying potential bugs or security issues
   - Suggesting code improvements
   - Explaining complex code sections
   - Analyzing code patterns

4. **Development Assistance**
   - Debugging and troubleshooting
   - Researching solutions to technical problems
   - Understanding unfamiliar codebases
   - Generating regular expressions and queries

### Required Practices

When using AI tools to assist with contributions to Kiali projects, contributors **MUST**:

1. **Understand the Code**
   - Thoroughly review all AI-generated code before submission
   - Ensure you understand what the code does and how it works
   - Be able to explain and defend the implementation in code reviews
   - You take responsibility for the contribution's content and origin

2. **Verify License Compliance**
   - Ensure AI tool terms and conditions do not conflict with [Kiali's license](./LICENSE)
   - Check if the AI tool's output restrictions are compatible with open source distribution

3. **Address Third-Party Materials**
   - If AI output includes pre-existing copyrighted materials or code from third parties:
     - Verify you have permission to use and modify such materials
     - Ensure the third-party material's license does not conflict with [Kiali's license](./LICENSE)
     - Provide proper attribution and license information
   - Consider using AI tool features that suppress or flag responses similar to copyrighted materials

4. **Test Thoroughly**
   - AI-assisted code must be accompanied by appropriate test code that validates its functionality
   - All tests must pass before submission

5. **Disclose AI Assistance**
   - Contributors are **REQUIRED** to disclose when AI assistance was used to generate issues, pull requests, and commits
   - In commit messages or pull request description fields, identify the code assistant that you used
   - Use a trailer such as `Assisted-by:` or `Generated-by:`
   - Example for commits and PRs:
     ```
     Assisted-by: Claude Code
     ```
   - In source file comments, indicate the use of the code assistant
   - Example for source files:
     ```
     # Generated-by: Cursor
     ```
     or
     ```
     // Assisted-by: Claude Code
     ```
   - Be transparent and honest about your development process
   - Maintainers may request additional information about code origin during reviews

## Community and Project Health

### For New Contributors

AI tools can help newcomers learn and contribute, but contributions should demonstrate:

- **Genuine Understanding**: Show familiarity with Kiali's purpose and architecture
- **Community Engagement**: Participate in discussions, ask questions, respond to feedback
- **Incremental Growth**: Build knowledge progressively rather than submitting large, unexplained changes
- **Responsiveness**: Address review feedback and iterate on contributions

### For Project Maintainers

Maintainers may ask about development methodology when code patterns suggest heavy AI assistance without understanding, security or correctness concerns arise, or contributions lack adequate explanation or testing. Contributors should respond honestly and transparently.

## Prohibited Practices

The following practices are **NOT PERMITTED**:

1. **Blind Submission**
   - Submitting AI-generated code without review or understanding
   - Copy-pasting AI output without verification
   - Contributing code you cannot explain or maintain

2. **License Violations**
   - Using AI-generated code that violates license compatibility
   - Including copyrighted material without proper licensing
   - Failing to provide required attribution

3. **Security Negligence**
   - Submitting code with known security vulnerabilities
   - Ignoring security warnings or best practices
   - Using AI to generate code handling secrets or credentials without proper review

4. **Gaming the System**
   - Creating artificial contribution velocity through bulk AI-generated submissions
   - Submitting low-quality or redundant contributions to inflate metrics
   - Using AI to simulate community engagement or discussions

5. **Misrepresentation**
   - Claiming AI-generated work as entirely your own
   - Falsely attributing work to other contributors
   - Providing misleading information about code origin

## Documentation and AI-Generated Content

### Technical Documentation

- AI-assisted documentation is permitted and encouraged for improving clarity
- All documentation must be technically accurate and reviewed by humans
- Contributors must verify examples and code snippets actually work
- Ensure documentation aligns with current Kiali features and APIs

### Design Documents and RFCs

- AI tools may assist in drafting proposals and design documents
- The human author must thoroughly understand and support the proposed design
- Design decisions must reflect genuine technical reasoning, not just AI suggestions
- Community discussion and iteration are essential components

### AI-Generated Images and Media

- **Technical Diagrams**: Flowcharts and technical illustrations generated by AI tools may be used if:
  - They accurately represent the content
  - They are not copyrighted elsewhere
- **Preferred Media**: Use original screenshots, diagrams created with standard tools, or properly licensed media
- **Avoid**: AI-generated decorative images or artwork due to copyright concerns

## Project-Specific Considerations

All AI-assisted contributions must follow the standards and testing requirements outlined in [CONTRIBUTING.md](./CONTRIBUTING.md) and [STYLE_GUIDE.adoc](./STYLE_GUIDE.adoc).

## Compliance with Employer Policies

Contributors should also comply with their employer's policies regarding:
- Use of AI tools for code development
- Contribution to open source projects
- Intellectual property rights
- Code of conduct and ethical AI use

If your employer's policy conflicts with this policy, please discuss with Kiali maintainers before contributing.

## Questions and Concerns

If you have questions about this policy or are unsure whether a particular use of AI tools is appropriate:

1. Ask in the Kiali community channels (Slack, GitHub Discussions)
2. Reach out to project maintainers

## References

This policy is based on and aligned with:

- [Linux Foundation Generative AI Policy](https://www.linuxfoundation.org/legal/generative-ai)
- [CNCF Guidelines for AI-Assisted Open Source Projects](https://github.com/cncf/toc/issues/1803)
- [CNCF Cloud Native AI Whitepaper](https://www.cncf.io/reports/cloud-native-artificial-intelligence-whitepaper/)
- [Open Source Definition](https://opensource.org/osd/)
- [Kiali's LICENSE](./LICENSE)

## Acknowledgments

The Kiali community recognizes that AI tools can accelerate development, improve code quality, and lower barriers to contribution. This policy aims to harness these benefits while maintaining the integrity, security, and collaborative spirit that make open source software thrive.
