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
- **Choose vehicle**
- **Enter plate number**
- **Upload OR/CR**
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
- Upload ID
- Upload business/DTI permit

> Note: After submiting your registration, please wait for the administrator's approval, which will be sent to your email.
