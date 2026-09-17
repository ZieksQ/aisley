---
title: User Registration Requirements
system: AISLEY
version: 1.0
status: Draft
role: Seller, Customer, Courier
---

# User Registration Requirements

## Customer - Registration

- **Last name\***
- **First name\***
- **Middle initial**
- **Sex\***
  - The age process is already handled by the API, but make the UI display the age of the customer
- **E-mail\***
- **Contact No.\***
- **Birthday\***
- **Age (autogen)\***
- **Address (API)**
  - Dropdown: Province, Municipality, Barangay
  - Manual entry: Street, House number, etc.
- **Upload ID**

> **Note:** After submitting your registration, please wait for the administrator's approval, which will be sent to your email.

---

## Seller - Registration

- **Last name\***
- **First name\***
- **Middle initial**
- **Sex\***
- **E-mail\***
- **Contact No.\***
- **Birthday\***
- **Age (autogen)\***
  - The age process is already handled by the API, but make the UI display the age of the seller
- **Address (API)**
  - Bundled PSGC dropdowns: Region, Province, City/Municipality, Barangay
  - Required manual entry between Province and City/Municipality: Postal code
  - Manual entry: Street, House number, etc.
  - Preserve a complete manual fallback when the bundled PSGC data is unavailable or incomplete
- **Business name**
- **Line of business (category)**
  - Dropdown to pick from sellers shop catagories
- **Upload ID**
- **Upload business permit**

> **Note:** After submitting your registration, please wait for the administrator's approval, which will be sent to your email. This should also verify the seller's shop and have access the order-management

---

## Courier - Registration

- **Last name\***
- **First name\***
- **Middle initial**
- **Sex\***
- **E-mail\***
- **Contact No.\***
- **Birthday\***
- **Age (autogen)\***
- **Address (API)**
  - Dropdown: Province, Municipality, Barangay
  - Manual entry: Street, House number, etc.
- **Vehicle type (required)** — exactly one vehicle per Courier; current types are motorcycle, car, and van.
- **Plate number (required)** — identifies that same sole vehicle.
- **Make/model (optional)** — editable vehicle details alongside required type/plate.
- **Upload OR (required)** and **Upload CR (required)** — separate Official Receipt and Certificate of Registration images under the shared upload policy. Planned registration keys are `official_receipt` and `certificate_of_registration`; current production accepts combined `vehicle_registration` until the coordinated API/client rollout.
- After initial approval, the Courier may edit type, plate, make, model and replace OR or CR independently without reapproval. Notify associated Logistics after every committed change; omission preserves the other document and removal without replacement is not supported.
- Maintenance, vehicle history, capacity values/units, and multiple/shared vehicles remain deferred. Existing registration decisions and shipment history remain preserved.
- **Upload ID/driver’s license**

> **Note:** After submitting your registration, please wait for the Logistic's approval, which will be sent to your email.

## Logistics - Registration

- Last name\*
- First name\*
- Middle initial
- Sex\*
- E-mail\*
- Contact No.\*
- Birthday\*
- Age (autogen)\*
- Operational hub/sorting-center address (API)
  - For the MVP, this address represents the organization's sole operational hub/sorting center.
  - Dropdown: Province, Municipality, Barangay
  - Manual entry: Street, House number, etc.
- Business name
- Operational hub map pin (planned)
  - After completing the hub address, use Geoapify assistance and Leaflet to confirm the actual hub location; save latitude and longitude together.
  - No Mapbox. Map failure preserves text-only registration and shows an unpinned state; complete the pin later in Logistics Account Settings.
  - The pin refers to the organization's sole hub, not the applicant's residence; coordinate correction does not authorize relocation.
- Upload ID
- Upload business/DTI permit

> Note: After submiting your registration, please wait for the administrator's approval, which will be sent to your email.
