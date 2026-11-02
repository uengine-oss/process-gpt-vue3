# Design notes

## Correlation key: why `origin_room_id`

Process mining needs a case notion. Chat rooms are long-lived and a room is not a
case, so we do not use the room id directly as the analytic key. Instead the room
where the work **started** is propagated forward into every receiving room, the
way an email thread carries the root message id in `References`.

- `origin_room_id` — structural thread key. Always present. Basis for grouping.
- `case_id` — analytic case key. Today equals `origin_room_id`; kept separate so a
  business key (quote no., contract no.) or case splitting can diverge later
  without breaking thread display.

Resolution order is deliberate: the value carried on the room (no query, survives
log loss) → tracing `handover_events` (covers rooms created before this feature)
→ this room is the root.

**Known limitation.** A long-lived room reused for two unrelated business cases
still collapses into one case. Business-key correlation and idle-based case
splitting are the intended follow-ups.

## Why a hand-written miner instead of pm4py

pm4py is GPLv3, which requires license review for commercial distribution. The
discovery path here is a small deterministic implementation:

```
handover_events → eventlog (case → activity sequence)
                → dfg (directly-follows + noise filter)
                → inductive (recursive cut detection → process tree)
                → to_procdef (ProcessGPT definition)
                → proposal (draft version + PR)
```

Deriving from a process tree is what buys soundness: a tree cannot express a
deadlock or an unreachable node, so the emitted definition is structurally valid
before any validator runs.

## Label trust by source

Not all events carry an activity name of equal quality:

| source | label | trust |
|---|---|---|
| `chat_handover` | user typed "what comes next" | trusted |
| `todolist` | BPMN activity name | trusted |
| `agent_delegation` | **raw triggering chat message** | not an activity name |

Treating the third as a label produced models where whole chat sentences became
process steps. Implicit delegations therefore contribute to the handover network
and automation statistics, but are excluded from control-flow discovery until a
normalized label exists. Adding that normalization (an LLM pass that turns a
turn into a verb-object activity name) is the natural next step and would let
those events rejoin discovery.

## Event log rules (stabilization, 2026-10-19)

Three kinds of events are built from one handover row:

| kind | activity | resource | used by |
|---|---|---|---|
| start | the sender's "done so far" on the thread's first trusted handover | sender | control flow, org mining |
| step | "next to do" | receiver | control flow, org mining |
| delegation | the activity the delegator holds at that moment | agent | network, automation, eligibility only |

The start step is what makes a two-person handover a two-step case, and keeps the
person who started the work in the model. Delegations stay out of control flow (the
label-trust rule above still holds) but are no longer dropped: attributing them to the
held activity is deterministic and needs no LLM. The network counts the row's own
`from → to` instead of consecutive performers.

Discovery follows the standard Inductive Miner: the log is split per cut and each part
is mined from its own sub-log, so optionality is counted within a branch; the loop cut
keeps start/end activities in the body and puts the rest in redo; when no cut exists the
fall-through is an unordered loop, never an exclusive choice.

## Rendering with the existing modeler

The miner emits the **flattened** runtime definition (`activities` / `gateways` /
`events` / `sequences`). The BPMN XML generator consumes the **authoring**
(`elements[]`) shape. The identification screen converts between them before
rendering rather than changing either contract.

Gateways carry no role of their own; lane placement is role-based, so a gateway
without a role would not land in any lane. The converter inherits the role of the
preceding node.

## Identification vs improvement

`/review-board` is driven by `proc_def_approval_state` — the lifecycle of a
definition that already exists. Identification has no existing definition to
attach to, which is why it needs its own screen and its own menu entry. Both,
however, land in the same `resource_pull_requests` approval workflow, so review
and approval behave identically for the user.

## When a thread is finished (2026-10-20)

A thread enters discovery only when the work item last received in it is completed.
"No further handover" cannot mark the end, because the last assignee never hands over.

| last handover went to | finished when |
|---|---|
| a person | that person's work item is completed (work board → 완료됨) |
| an agent | the sender ends the work in that room (`closed_at`) |

The agent row differs because the agent's work item completes by itself while the sender
stays in the room and may still pass the result on. The "end work" action is offered only
there, so a person's end is never decided by two different signals.

Handing over from a received room completes the sender's received work item — the screen
already says the work was done and passed on, and the record has to say the same. The
miner reads these records as they are; it does not reconstruct missing completions.

## Files travel through the receiving room's workspace

Handed-over files are copied into `files/skills/{tenant}/{receiving room}/`, the prefix the
agent hydrates its room workspace from. The receiving room's agent finds them on its first
turn, the briefing lists them as work-folder entries, and they are candidates again for the
next handover. Storage rejects keys with characters such as Korean; such path segments are
encoded as `__u8__` + base64url(UTF-8) on upload and decoded on hydration — the same rule
in deepagents and the frontend.

A work item handed to an agent runs on the task poller. Its query carries
`[ChatRoom] <room id>`, so the poller works in that room's workspace and leaves its result
(text and published documents) as one message in the room.

## One process per business (2026-10-20)

A tenant's handover log mixes businesses — quotes, contracts, purchases. Mining them as
one log puts an exclusive choice between businesses at the very first step: each branch is
observed, yet different processes are drawn as branches of one. Finished threads are
therefore grouped before discovery by the set of steps they went through: two threads are
the same business when their step sets overlap by at least half (Jaccard ≥ 0.5), and
connected threads form one group (single linkage). Rework variants (0.75) and approver
variants (0.5) stay together; businesses that share no step split. The group id is the
same deterministic id as the proposed definition, so re-proposing a business versions one
definition. Threads in progress are attached to the closest group for display only.

## Receiving room shows the earlier conversation (2026-10-23)

The receiving room is still a new room, but its top shows the conversations of the rooms this
work came through, read-only, from the room where it started to the room just before. Each room
is cut at the moment it handed over; what was said there afterwards is not this work's context.
The chain is walked through `handover_events.to_room_id → from_room_id`. Copying the conversation
into `대화 기록 (n).md` files stays, because an agent recipient reads its context from the workspace.

Inviting the receiver into the existing room was rejected: with parallel handover the branches'
work and the agents' workspace folders would mix in one room, and the miner could no longer tell
which branch a message belongs to.

## Parallel handover (2026-10-23)

One handover can go to several people or agents. Each receiver gets one row and one new room;
rows from the same handover share `group_id` (null for a single receiver).

| in one group | derived as |
|---|---|
| different next activities | parallel (AND) |
| same next activity | one activity marked multi-instance |

No join is configured. A grouped thread is finished when every branch leaf (a row whose
receiving room did not hand over again) is finished, by the same per-row rule as before.

Discovery stays trace-based. A time-ordered trace interleaves branches, so for grouped cases the
event log is rebuilt along the room tree and emitted once per branch rotation (each branch comes
first once, so every branch has a start and an end), and activity pairs from different branches
are passed to the DFG as both-direction edges so the parallel cut is found. Optionality is judged
by "present in every trace", so several traces per case do not change it. Threads without
`group_id` keep the old trace and the old end rule — their results are unchanged.

ProcessGPT definitions have no multi-instance property on a regular activity, so it is not
invented in the definition JSON. The miner reports `multi_instance_activities`; the identification
screen adds the standard `multiInstanceLoopCharacteristics` to the rendered BPMN XML only.
