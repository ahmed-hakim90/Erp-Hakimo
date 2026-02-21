PROMPT — Quality Control Module Phase 1

Create a Quality Control module integrated with production system.

1️⃣ Create Collections

quality_reports

quality_settings

defect_types

2️⃣ Quality Report Fields

Include:

productId

lineId

productionPlanId (optional)

productionReportId (optional)

inspectorId

inspectedQuantity

defectiveQuantity

severity

notes

images[]

status

qualityScore (computed)

3️⃣ Calculations

qualityScore = (inspected - defective) / inspected

4️⃣ Add Pages

QualityReports page (CRUD)

QualityInspectors page

QualitySettings page

5️⃣ Add RBAC

quality.view
quality.create
quality.edit
quality.resolve

6️⃣ Link to Production Reports

Show quality score inside production report page.

Keep UI consistent with system theme.




PROMPT — Quality Control Phase 2 (Advanced System)

Enhance Quality Control module with advanced industrial features.

1️⃣ Add inspectionType

Sampling

FullInspection

BatchInspection

2️⃣ Add severity system

Minor / Major / Critical with weight

3️⃣ Implement impactScore

impactScore = (defective × severityWeight) / inspected

4️⃣ Add Smart Alerts

Trigger notifications when:

severity = Critical

defectRate > threshold

repeated defectType

5️⃣ Add Quality Analytics Page

Include:

Pareto chart

Trend chart

Line quality ranking

6️⃣ Add Corrective Actions module

Link actions to quality report

7️⃣ Integrate with Production Plans

Show quality health and block plan completion if quality below threshold (optional via settings)

Keep UI consistent and minimal.




PROMPT — Implement In-Process Quality Control (IPQC)

We are implementing In-Process Quality Control integrated with production.

1️⃣ Create collection:

inprocess_quality_checks

Fields:

lineId

productionPlanId

stage

inspectedQuantity

defectiveQuantity

severity

stopLineRecommended

images

qualityScore

2️⃣ Add live monitoring page:

Show active lines

Show latest quality check

Show defect rate trend

Show alerts

3️⃣ Implement stop-line logic:

If defectRate > threshold OR severity = Critical:

Change line status to "Quality Hold"

Send notification to supervisor & manager

4️⃣ Integrate with:

Production Reports

Production Plans

Dashboard Alerts

5️⃣ Add settings:

defectRateThreshold

requiredChecksPerShift

allowSupervisorOverride

Keep UI minimal and consistent.