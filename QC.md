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