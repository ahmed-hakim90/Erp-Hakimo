# Wireframe Architecture — 🏭 HAKIMO — نظام إدارة الإنتاج

This is a behavioral blueprint, not a redesign.

## Canonical anatomy

Global navigation → location/title/context/one primary action → only useful search/filter/summary → main task content → contextual detail/edit surface → local feedback and recovery states.

Before implementation map: **Page goal → user journey → information architecture → sections → priority → actions → states → responsive/RTL behavior → shared components.**

Prove the system on a high-traffic primary-journey screen, a data-dense/management screen when present, and a form/detail screen. Mobile uses a priority column, reachable actions, sheets for secondary controls, safe-area and keyboard awareness. Tablet adapts deliberately. Desktop uses efficient density and consistent containers. RTL/LTR keep equal information priority with correct directional order and controls.
