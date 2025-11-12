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
- [Review and Evolution](#review-and-evolution)
- [Questions and Concerns](#questions-and-concerns)
- [References](#references)
- [Acknowledgments](#acknowledgments)

## Purpose

This AI Policy establishes guidelines for the use of Artificial Intelligence (AI) and Machine Learning (ML) tools in the development, documentation, and maintenance of Kiali projects. As a CNCF-aligned project in the Istio service mesh ecosystem, Kiali is committed to maintaining high standards of code quality, community engagement, and open source principles while embracing responsible innovation.

This policy is aligned with the Linux Foundation's Generative AI Policy and CNCF guidelines for AI-assisted open source projects.

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
- Contributions must align with Kiali's open source license (Apache 2.0)
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
   - Ensure AI tool terms and conditions do not conflict with:
     - Apache 2.0 license
     - Kiali's intellectual property policies
     - The [Open Source Definition](https://opensource.org/osd/)
   - Check if the AI tool's output restrictions are compatible with open source distribution

3. **Address Third-Party Materials**
   - If AI output includes pre-existing copyrighted materials or code from third parties:
     - Verify you have permission to use and modify such materials
     - Ensure the third-party license is compatible with Apache 2.0
     - Provide proper attribution and license information
   - Consider using AI tool features that suppress or flag responses similar to copyrighted materials

4. **Test Thoroughly**
   - Write and run appropriate tests for AI-assisted code
   - Verify the code works as intended in the Kiali environment
   - Test edge cases and error conditions
   - Ensure integration with existing Kiali components

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
     # Generated by Cursor
     ```
     or
     ```
     // Assisted-by: Claude Code
     ```
   - Be transparent and honest about your development process
   - Maintainers may request additional information about code origin during reviews

### Quality Standards

All contributions, whether AI-assisted or not, must meet these standards:

1. **Technical Depth**
   - Demonstrate understanding of the problem space
   - Show awareness of Kiali architecture and design patterns
   - Consider performance, scalability, and maintainability

2. **Code Quality**
   - Follow Kiali coding standards and conventions
   - Include appropriate error handling
   - Provide meaningful variable and function names
   - Avoid overly complex or obscure implementations

3. **Documentation**
   - Include clear comments for complex logic
   - Update relevant documentation
   - Provide examples where appropriate
   - Document any assumptions or limitations

4. **Security**
   - Avoid common security vulnerabilities (injection, XSS, etc.)
   - Follow secure coding practices
   - Handle sensitive data appropriately
   - Consider security implications of dependencies

## Community and Project Health

### For New Contributors

AI tools can help newcomers learn and contribute, but contributions should demonstrate:

- **Genuine Understanding**: Show familiarity with Kiali's purpose and architecture
- **Community Engagement**: Participate in discussions, ask questions, respond to feedback
- **Incremental Growth**: Build knowledge progressively rather than submitting large, unexplained changes
- **Responsiveness**: Address review feedback and iterate on contributions

### For Project Maintainers

Maintainers should:

1. **Evaluate Based on Merit**
   - Focus on the quality and value of contributions, not the tools used
   - Review code for correctness, security, and design quality
   - Request clarification when code origin or understanding is unclear

2. **Encourage Best Practices**
   - Provide constructive feedback on AI-assisted contributions
   - Guide contributors toward better understanding and implementation
   - Recognize and mentor promising contributors

3. **Maintain Standards**
   - Ensure all contributions meet quality thresholds
   - Reject contributions that show insufficient understanding or testing
   - Request modifications when code doesn't align with project standards

4. **Right to Request Information**
   - Maintainers may ask about development methodology when:
     - Code patterns suggest heavy AI assistance without understanding
     - Security or correctness concerns arise
     - Contribution lacks adequate explanation or testing
   - Contributors should respond honestly and transparently

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

- AI-generated images are **NOT PERMITTED** in Kiali documentation or design materials due to potential copyright infringement
- Use original images, screenshots, diagrams created with standard tools, or properly licensed media

## Project-Specific Considerations

### For Kiali Console (UI/Frontend)

- Ensure AI-generated UI components follow accessibility standards (WCAG)
- Verify components work with PatternFly design system
- Test across supported browsers
- Validate internationalization and localization compatibility

### For Kiali Server (Backend)

- Ensure compatibility with supported Kubernetes and Istio versions
- Verify proper error handling and logging
- Test performance implications
- Validate API contract compatibility

### For Kiali Operator

- Test deployment scenarios thoroughly
- Verify CRD schema changes are backward compatible
- Validate RBAC and security configurations

## Compliance with Employer Policies

Contributors should also comply with their employer's policies regarding:
- Use of AI tools for code development
- Contribution to open source projects
- Intellectual property rights
- Code of conduct and ethical AI use

If your employer's policy conflicts with this policy, please discuss with Kiali maintainers before contributing.

## Review and Evolution

This policy will be:
- Reviewed annually or as needed based on community feedback
- Updated to reflect evolving AI technology and best practices
- Aligned with CNCF and Linux Foundation guidance
- Modified based on Kiali community experiences and needs

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
- [Apache License 2.0](https://www.apache.org/licenses/LICENSE-2.0)

## Acknowledgments

The Kiali community recognizes that AI tools can accelerate development, improve code quality, and lower barriers to contribution. This policy aims to harness these benefits while maintaining the integrity, security, and collaborative spirit that make open source software thrive.
