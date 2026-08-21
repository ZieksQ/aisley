# Progress

Short, dated log of what's been implemented. Update this after every feature/change is completed — don't let it go stale.

Format:
```
## YYYY-MM-DD
- Feature/change summary
```

---

## Status
Active development in progress.

## 2026-08-21
- **Seller Portal (`src/seller`)**:
  - Auth: 3-step registration wizard with auto-fill test data, login screen, and pending approval screen.
  - Dashboard: stats overview, sales chart, and pending fulfillment alerts.
  - Products & Inventory: catalog table with search/filters, add/edit modal, and stock controls.
  - Vouchers: promo code creation, discount types, and usage limits.
  - Orders: fulfillment pipeline tabs, order inspector drawer, courier pickup scheduling, and printable waybills.
  - Reports: sales and net profit summary, CSV export, and printable statement.
  - Chat & Reviews: buyer messaging with canned replies and product attachments, plus buyer review management.
  - Settings & Theme: store profile info, vacation mode, payout bank configuration, and dark/light mode toggle with theme switcher in top bar and settings.
  - UI refinement: removed top marquee, replaced top message button with a floating buyer chat button at the bottom-right.
  - Dark mode & UI polish: fixed progress bar & badge contrasts in dark mode, aligned all icons, and improved mobile table responsiveness.
  - Settings & Metrics: reorganized settings into sub-sidebar categories and aligned metric card headers with icons.
  - UI & UX Polish: masked session IP by default with reveal toggle, added unsaved changes guard & vacation confirmation modals, and fixed table column widths and metric card number scaling.
  - Chat Docking: pinned message input to the bottom of the chat viewport with independent message scroll.
  - Verification Documents: added valid government ID and Mayor's/municipal business permit file upload and camera capture to registration, status view, and settings.
