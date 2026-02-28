# Quality Module Checklist

## Environment
- [ ] Configure `.env.local` with all `VITE_FIREBASE_*` values.
- [ ] Deploy Firestore rules from `firestore.rules`.
- [ ] Deploy Firestore indexes from `firestore.indexes.json`.

## End-to-End Scenarios
- [ ] Final Inspection `passed` saves inspection and updates work order quality summary.
- [ ] Final Inspection `failed` requires reason and creates defect.
- [ ] Final Inspection `rework` requires reason and creates both defect and rework order with valid `defectId`.
- [ ] IPQC `rework` creates rework order and updates work order quality status consistently.
- [ ] CAPA creation supports optional linking to `workOrderId` and `defectId`.
- [ ] Rework status transitions (`open`, `in_progress`, `done`, `scrap`) persist correctly.

## Printing and Reports
- [ ] Final Inspection print/PDF uses dedicated print template output.
- [ ] IPQC print/PDF uses dedicated print template output.
- [ ] Rework print/PDF uses dedicated print template output.
- [ ] CAPA print/PDF uses dedicated print template output.
- [ ] Quality Reports auto-load when `workOrderId` exists in query string.
- [ ] `PDF KPI` and `PDF Defects` export different report layouts.

## Permissions and Navigation
- [ ] Quality routes are visible only with matching `quality.*.view` permissions.
- [ ] Action buttons (inspect/manage/print) follow granular permissions.
- [ ] Quality pages are grouped under the `quality` menu group.
- [ ] Legacy quality permissions still map correctly through fallback compatibility.

## User Feedback and Reliability
- [ ] Save/export failures are surfaced to user (no silent failures).
- [ ] Save/export successes are surfaced to user.
- [ ] Notification fanout failures do not block main business action.

