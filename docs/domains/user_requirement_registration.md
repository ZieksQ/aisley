---
system: AISLEY
domain: User Registration
type: Requirements
purpose: AI Vibe Coding Context
version: 1.0
status: Draft
---

# User Registration

## WHAT

Aisley supports registration for three public user roles:

- Buyer
- Seller
- Courier

Each role provides personal information, contact information, an address, and role-specific verification documents.

After registration is submitted:

1. The account/application waits for administrator review.
2. The administrator approves or rejects the registration.
3. The registration result is sent to the applicant's email.

> Logistics and Admin registration requirements are not defined in this document.

---

# Shared Registration Fields

The following fields are present for **Buyer, Seller, and Courier**.

| Field | Input / Behavior |
| --- | --- |
| Last Name | Text input |
| First Name | Text input |
| Middle Initial | Text input |
| Sex | Selection input |
| Email | Email input |
| Contact Number | Contact input |
| Birthday | Date input |
| Age | Automatically generated |
| Address | Structured address + manual address details |

## Address Structure

The address uses two input methods.

### API / Dropdown Fields

- Province
- Municipality
- Barangay

### Manual Fields

Examples mentioned in the requirements:

- Street
- House number
- Other detailed address information

The exact address API/provider is **not specified**.

---

# Buyer Registration

## Fields

Buyer registration contains the shared registration fields plus:

- Upload ID

## Required Documents

- Identification document

The accepted ID types, file formats, file-size limits, and verification rules are **not specified**.

## Registration Flow

```text
Buyer fills registration form
        ↓
Buyer enters personal/contact information
        ↓
Buyer selects structured address
        ↓
Buyer enters detailed street/house address
        ↓
Buyer uploads ID
        ↓
Buyer submits registration
        ↓
Registration awaits Admin approval
        ↓
Admin reviews registration
        ↓
Applicant receives result through email
```

---

# Seller Registration

## Fields

Seller registration contains the shared registration fields plus:

- Business Name
- Line of Business / Category
- Upload ID
- Upload Business Permit

## Business Information

### Business Name

Stores the seller's business/store name.

### Line of Business

Represents the category or type of business.

The available categories and whether sellers may select more than one category are **not specified**.

## Required Documents

- Identification document
- Business permit

Document types, validation requirements, expiration handling, file formats, and file-size limits are **not specified**.

## Registration Flow

```text
Seller fills registration form
        ↓
Seller enters personal/contact information
        ↓
Seller selects structured address
        ↓
Seller enters detailed street/house address
        ↓
Seller enters business information
        ↓
Seller uploads ID
        ↓
Seller uploads business permit
        ↓
Seller submits registration
        ↓
Registration awaits Admin approval
        ↓
Admin reviews registration
        ↓
Applicant receives result through email
```

---

# Courier Registration

## Fields

Courier registration contains the shared registration fields plus:

- Vehicle
- Plate Number
- Upload OR/CR
- Upload ID / Driver's License

## Vehicle Information

### Vehicle

The courier chooses a vehicle.

The supported vehicle types are **not specified**.

### Plate Number

The courier provides the registered plate number of the vehicle.

## Required Documents

- OR/CR
- ID or Driver's License

The source describes this as:

`Upload ID/driver's license`

It does not explicitly state whether:

- either an ID **or** driver's license is acceptable, or
- a driver's license is mandatory for particular vehicle types.

Do not invent this rule without a separate requirement.

## Registration Flow

```text
Courier fills registration form
        ↓
Courier enters personal/contact information
        ↓
Courier selects structured address
        ↓
Courier enters detailed street/house address
        ↓
Courier chooses vehicle
        ↓
Courier enters plate number
        ↓
Courier uploads OR/CR
        ↓
Courier uploads ID / driver's license
        ↓
Courier submits registration
        ↓
Registration awaits Admin approval
        ↓
Admin reviews registration
        ↓
Applicant receives result through email
```

---

# Shared Approval Workflow

All three registration types follow the same high-level approval process.

```text
REGISTER
   ↓
SUBMIT APPLICATION
   ↓
PENDING ADMIN REVIEW
   ↓
ADMIN DECISION
   ├── APPROVED
   │      ↓
   │   EMAIL APPLICANT
   │
   └── REJECTED
          ↓
       EMAIL APPLICANT
```

At minimum, the registration domain therefore needs to represent the concept of:

- submitted registration
- pending administrator approval
- administrator decision
- email notification

Exact database status names are **not specified** by this requirements document.

---

# Role Comparison

| Requirement | Buyer | Seller | Courier |
| --- | :---: | :---: | :---: |
| Personal Information | ✓ | ✓ | ✓ |
| Contact Information | ✓ | ✓ | ✓ |
| Birthday | ✓ | ✓ | ✓ |
| Auto-generated Age | ✓ | ✓ | ✓ |
| Structured Address | ✓ | ✓ | ✓ |
| Manual Address Details | ✓ | ✓ | ✓ |
| ID Upload | ✓ | ✓ | ✓ / Driver's License |
| Business Name | — | ✓ | — |
| Line of Business | — | ✓ | — |
| Business Permit | — | ✓ | — |
| Vehicle | — | — | ✓ |
| Plate Number | — | — | ✓ |
| OR/CR | — | — | ✓ |
| Admin Approval | ✓ | ✓ | ✓ |
| Email Approval Result | ✓ | ✓ | ✓ |

---

# AI Implementation Rules

When implementing registration from this document:

- Reuse shared registration logic for Buyer, Seller, and Courier where possible.
- Keep role-specific fields separated from shared user information.
- Calculate `age` from `birthday` rather than asking the user to manually enter it.
- Keep Province, Municipality, and Barangay as structured address values.
- Keep Street, House Number, and similar detailed address information as manually entered values.
- Require administrator review after registration submission.
- Send the administrator's registration decision to the applicant's email.
- Do not treat a submitted registration as automatically approved.
- Do not invent document requirements, vehicle types, seller categories, or validation rules that are not defined here.

---

# Source Ambiguities / Open Questions

The original requirements use `*` and `_` suffixes on some fields, but their exact meaning is not formally defined.

Examples:

- `Last name*`
- `Contact No._`
- `Birthday_`
- `Age (autogen)*`

Therefore an implementation agent should **not assume that `_` means optional or that `*` means required unless this convention is confirmed elsewhere in the project**.

Other unresolved requirements:

- Exact required/optional fields
- Minimum registration age
- Accepted ID types
- Upload file types
- Upload file-size limits
- Business permit validation
- Seller business categories
- Courier vehicle types
- Driver's license rules
- OR/CR validation
- Address API/provider
- Duplicate email handling
- Duplicate identity/document handling
- Rejected registration resubmission behavior
- Approval/rejection email contents
- Whether users can log in before approval
- Whether rejected accounts are retained or deleted

These should remain open requirements until defined by another Aisley specification.