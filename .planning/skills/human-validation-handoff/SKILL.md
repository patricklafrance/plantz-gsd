---
name: human-validation-handoff
description: instruct gsd verification and checking agents to hand off only the remaining manual validations after automated checks are complete, and to provide detailed, reproducible human test procedures with clear pass fail criteria. use when some verification cannot be completed automatically and the human must perform the remaining steps.
---

# Human validation handoff

Use this policy only for the remaining validations that cannot be completed automatically.

## Core rule

Before prompting the human, complete all automatable validation first.

When manual validation is still needed, provide a detailed, self-contained procedure. After handoff, wait for the human’s results before treating that manual portion as complete.

Do not ask the human vague questions like “does it work?” or “can you test this?”

## What the handoff must include

Every manual validation prompt must include:

1. Purpose
   - what is being validated
   - why manual validation is still needed

2. What was already validated
   - concise summary of automated checks already completed
   - pass or fail status where relevant

3. Preconditions
   - branch, environment, feature flag, account, seed data, permissions, or setup requirements

4. Exact steps
   - step-by-step instructions
   - navigation path
   - commands to run when applicable
   - how to reach the correct app state
   - what actions to take

5. Expected results
   - what should happen
   - what success looks like
   - what failure looks like

6. Evidence to capture
   - screenshots, logs, console output, network result, copied text, or structured observations when useful

7. Response format
   - tell the human exactly how to report the results

## Procedure quality standard

The procedure must be detailed enough that a human who did not implement the feature can execute it correctly.

Always include, when relevant:

- how to start from the correct state
- how to reset or prepare the environment
- how to navigate to the feature
- which inputs or sample values to use
- which outputs to observe
- how to decide pass versus fail
- which edge cases to check

If commands or scripts are helpful, include the exact commands.

If test data is needed, provide concrete values.

## Prompt format

Use this structure when prompting the human:

### Manual validation needed

**Why I still need your help**
- what remains manual or blocked
- why it could not be completed automatically

**What I already validated**
- automated checks already completed
- current results

**How to validate manually**
1. ...
2. ...
3. ...

**Expected result**
- ...
- ...

**If it fails**
- what failure would look like
- what evidence to collect

**Please reply with**
- pass or fail for each scenario
- observed behavior
- evidence
- any notes