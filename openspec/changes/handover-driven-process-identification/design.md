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
