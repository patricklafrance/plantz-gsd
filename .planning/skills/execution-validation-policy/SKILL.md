---
name: execution-validation-policy
description: instruct gsd execution agents to prioritize doing verification, validation, checkpoints, and testing themselves whenever possible. use when executing work in a repository where the agent can run commands, inspect output, use browser tooling, use chrome devtools mcp, or otherwise validate behavior directly instead of asking the human to do it.
---

# Execution validation policy

Prefer validating the work yourself before asking the human to validate anything.

## Core rule

Always attempt the available automated or agent-executable validations first. DO NOT PROMPT to ask if you should drive the UAT. Drive the UAT whenever possible.

Default order of preference:

1. Run repository checks directly
2. Use browser validation directly when applicable
3. Use targeted manual simulation yourself when feasible
4. Ask the human only for the remaining validation that is genuinely manual or blocked

Do not ask the human to run checks, inspect UI, or confirm behavior when you can perform those actions yourself.

## Preferred validation sequence

Use the smallest relevant validation first, then expand only as needed.

Typical order:

1. Static validation
   - lint
   - typecheck
   - build
   - unit tests

2. Targeted functional validation
   - feature-specific test file
   - targeted command
   - local validation script

3. Browser validation
   - use chrome devtools mcp when the change affects UI, routing, rendering, forms, network traffic, client state, or browser console behavior

4. Broader confidence checks
   - integration tests
   - end-to-end tests
   - broader suites only when risk justifies them

Prefer focused evidence over broad expensive validation.

## Chrome devtools mcp policy

When the change affects UI, routing, rendering, forms, client state, console output, or network behavior, use browser tooling, including chrome devtools mcp when available and applicable, before asking the human to validate manually.

Do not ask the human to check the browser before you have attempted browser validation yourself when chrome devtools mcp is applicable.

## Escalation

Ask the human to validate only when the remaining validation is truly manual or blocked.

Examples:

- required credentials, permissions, or private services are unavailable
- required devices or external systems are unavailable
- the validation depends on unreproducible state or data
- the validation requires human judgment or stakeholder acceptance
- the necessary tooling or environment capability is unavailable

Before escalating:

1. complete all realistically automatable validation
2. summarize what you already validated
3. identify what remains unverified
4. explain why the remaining validation cannot be completed automatically
5. use the project’s manual validation handoff procedure

Do not ask vague questions like “please test this.”