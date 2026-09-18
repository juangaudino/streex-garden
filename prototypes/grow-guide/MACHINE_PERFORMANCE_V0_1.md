# Machine Performance V0.1

Status: deterministic foundation. No AI. No invented outcomes.

## Product rule
Machine Performance compares Juan's subjective evaluation of a physical Machine Instance with objective evidence accumulated by that same instance. A metric is shown only when its source data exists and its denominator/context is known.

Machine Model -> Machine Instance -> Garden/Cycle remains the canonical relationship.

## Metric contract

| Metric | Source facts | Minimum evidence | Display rule |
| --- | --- | --- | --- |
| Completed cycles | Garden/cycle history | >=1 closed cycle | Count only explicitly completed cycles |
| Current cycle age | currentGardenSince | active garden + start date | Deterministic elapsed days |
| Maintenance events | maintenanceEvents | >=1 event | Count + latest event |
| Cleaning interval | maintenanceEvents[type=cleaning] | >=2 cleanings | Median/average interval may be derived; label method |
| Germination rate | cycle/pod outcomes | known planted denominator + germinated numerator | Never infer missing pods as failures |
| Harvest activity | harvest events | >=1 confirmed harvest | Count events first; yield only when quantity/unit exists |
| Incident count | confirmed machine/cycle incidents | >=1 event | Do not mix plant observations with machine incidents |
| Cycle duration | closed cycle start/end | >=1 closed cycle | Per-cycle days; aggregate only with >=2 comparable cycles |
| Grow performance | objective metrics above | sufficient evidence per component | Never synthesize an opaque score in V0.1 |

## Subjective side
Existing User Zero ratings remain human evaluations: Build Quality, Ease of Use, Grow Performance, Lighting, Water System, Maintenance, Value for Money, Overall Rating and Would Buy Again.

These are not rewritten by objective data.

## Evidence states
- **Available**: enough canonical facts exist to calculate the metric.
- **Building evidence**: relevant facts exist but minimum evidence is not met.
- **Not tracked yet**: required canonical facts do not exist.
- **Not applicable**: metric does not make sense for this instance/cycle.

## V0.1 UI
Machines may expose a compact Performance / Evidence panel. It can show current-cycle age and maintenance facts now. Germination, harvest, incidents and completed-cycle comparisons stay hidden or explicitly pending until canonical Garden/Cycle data is connected.

No fake zeros. No estimated percentages. No AI narrative.

## Next integration gate
Connect Garden/Cycle canonical facts to Machine Instance without copying Plant Story into Gardenpedia. Gardenpedia consumes references/derived aggregates; Garden X remains canonical for plant history.
