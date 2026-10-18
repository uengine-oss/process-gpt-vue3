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
