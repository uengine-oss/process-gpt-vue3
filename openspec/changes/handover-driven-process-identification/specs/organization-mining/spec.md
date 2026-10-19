# organization-mining Specification

## ADDED Requirements

### Requirement: The organization model expresses capability, not just membership
The organization model MUST be able to express what a piece of work requires and
who is qualified to do it, not only which team someone belongs to. Without this,
a process step can only name a person, and nothing derived from handover records
has anywhere to attach.

Three layers SHALL exist: a capability catalog, the capabilities a resource holds,
and the eligibility requirements of an activity. A held capability MUST record
whether it was declared by an administrator or observed from handover records,
and observed ones MUST carry the number of observations that support them.

#### Scenario: An observed capability carries its evidence
- **GIVEN** a resource has performed an activity several times
- **WHEN** the capability is derived from handover records
- **THEN** it MUST be marked as observed
- **AND** it MUST record how many observations support it

#### Scenario: Eligibility can be expressed without naming a person
- **GIVEN** an activity that requires approval authority
- **WHEN** its eligibility is recorded
- **THEN** it MUST be expressible as a required capability, role or department
- **AND** it MUST NOT be limited to a specific person

### Requirement: Roles are derived from what resources actually do
Role clusters MUST be derived by grouping resources whose activity profiles are
similar, rather than by reading an existing title. People and AI agents SHALL be
clustered together; when both appear in one cluster the role MUST be reported as
mixed, meaning the work is done by either.

Role names MUST come from the observed activities. The miner MUST NOT invent a
role name that has no basis in the log.

#### Scenario: Two resources doing the same activity form one role
- **GIVEN** two resources that both perform the same activity and nothing else
- **WHEN** role clustering runs
- **THEN** they MUST appear in the same cluster

#### Scenario: A human and an agent doing the same work is flagged
- **GIVEN** an activity performed sometimes by a person and sometimes by an agent
- **WHEN** role clustering runs
- **THEN** the resulting role MUST be flagged as mixed

### Requirement: Activity eligibility is derived with its evidence
For each observed activity the system MUST report who has performed it, how many
times, and what share of the executions were automated. This is what allows a
later handover to say why a given person is a candidate.

#### Scenario: Candidates are ranked by evidence
- **GIVEN** an activity performed 8 times by one person and once by another
- **WHEN** eligibility is derived
- **THEN** the person with 8 observations MUST be listed first
- **AND** each candidate MUST carry its observation count

#### Scenario: A fully automated step reports an automation rate of one
- **GIVEN** an activity that only agents have ever performed
- **WHEN** eligibility is derived
- **THEN** its automation rate MUST be 1

### Requirement: Handover network treats people and agents as one graph
The handover network MUST be computed over people and agents together, since both
are resources of the organization. It MUST NOT be split into separate human and
agent graphs.

#### Scenario: Transfers between a person and an agent are counted
- **GIVEN** work moves from an agent to a person and then to another person
- **WHEN** the handover network is computed
- **THEN** both transfers MUST appear as edges with their counts

#### Scenario: An implicit delegation is counted without an activity name
- **GIVEN** a person delegates to an agent while holding an activity, with no normalized label
- **WHEN** the handover network and eligibility are computed
- **THEN** the person → agent transfer MUST appear in the network
- **AND** the agent MUST be a candidate for the activity the person was holding
- **AND** that activity's automation rate MUST include the delegation
- **AND** the delegation MUST NOT appear in the discovered control flow

### Requirement: Mining APIs are scoped to the caller's tenant
Mining results MUST only include records of a tenant the caller belongs to, as
established from the caller's verified token. A request without a tenant MUST NOT
return records of any other tenant.

#### Scenario: A request without credentials is rejected
- **GIVEN** a request with no bearer token
- **WHEN** any mining endpoint is called
- **THEN** it MUST be rejected and no handover record may be read

#### Scenario: Another tenant cannot be requested
- **GIVEN** a caller who belongs only to tenant A
- **WHEN** the caller requests tenant B
- **THEN** the request MUST be refused

### Requirement: Eligibility surfaces when choosing the next assignee
Resources that have actually performed the next step before MUST be marked as
eligible in the handover assignee picker, and SHALL be ordered ahead of the
others, so the choice is informed by evidence rather than by memory.

#### Scenario: A prior performer is marked eligible
- **GIVEN** the next step is one that a particular person has performed before
- **WHEN** the assignee picker is shown
- **THEN** that person MUST be marked as eligible
- **AND** MUST appear before resources with no such history

### Requirement: The assignee picker separates people from agents
The picker MUST let the user narrow candidates by kind — all, people, or agents —
because some steps must be done by a person. Built-in agents that exist only in
client defaults MUST also be listed, so the picker is not silently missing an option.

#### Scenario: The people tab excludes agents
- **GIVEN** the picker is open
- **WHEN** the user selects the people tab
- **THEN** only non-agent resources MUST be listed

#### Scenario: Built-in agents are not missing from the agent tab
- **GIVEN** the deployment has agents that are not rows in the user table
- **WHEN** the user selects the agent tab
- **THEN** those agents MUST still be listed
