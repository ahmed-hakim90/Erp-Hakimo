# Component Strategy — 🏭 HAKIMO — نظام إدارة الإنتاج

Stack: **JavaScript/Node.js**.

## Reuse order

Existing stable component → semantic variant → composition → new shared primitive/pattern after repository-wide search → page-local component only when genuinely single-use.

Inventory buttons, links, inputs, selects, form fields, status, feedback, skeletons, dialogs, drawers/sheets, menus, typography, layout, containers, navigation, page headers, filters, lists/tables, pagination, forms, upload, confirmation, empty/error states, and repeated domain units.

Prefer composition, slots, semantic props, predictable defaults, and documented variants. Avoid prop sprawl and page-specific escape hatches. Keep business rules, permissions, data access, validation, and side effects outside presentation.

Before adding or migrating a pattern, compare all equivalents using KEEP / IMPROVE / REPLACE / REMOVE and verify a representative consumer.
