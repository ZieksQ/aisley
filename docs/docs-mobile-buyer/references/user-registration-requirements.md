# Customer registration reference

Buyer-only adaptation of upstream `docs/references/user-registration-requirements.md` and current Customer Auth spec/Requests at the [baseline](source-provenance.md). This reference documents desired requirements and existing API differences; it does not extend validation or evidence storage by itself.

Desired Customer identity: first/last name, optional middle initial/name, sex, email, contact number, birthday, server-derived age, Philippine address with administrative hierarchy/manual street fields, and ID evidence. A registration waits for **Admin** approval. Courier's associated-Logistics approval and vehicle evidence are outside Buyer scope.

Current API keys are `first_name,last_name,middle_name?,contact_number,sex,birth_date,email,password,password_confirmation`. It uses `middle_name`, not a new `middle_initial` alias. Age is derived from birth date; sex is an allow-listed enum; credentials meet Laravel validation. Registration creates pending User/CustomerProfile/RegistrationApplication and no session/token. Duplicate Customer email is role-scoped.

Address and ID upload requirements are **not implemented in Customer registration**. Do not submit nested address or `government_id` copied from Courier and claim it is saved. Address Book after approved login is a separate implemented feature. An extension needs coordinated Customer Request/service/storage/Admin review/API/tests and an additive schema decision if necessary; it is not authorized by this client bundle.

There is no authenticated pending-applicant status API, rejected resubmission contract or appeal exception to protected Customer support. The pending screen is informational and login later revalidates status. Do not promise actual email delivery on registration/decision solely because the reference requests an email; verify deployment/notification behavior with the backend owner.

Future evidence must follow [upload policy](file-upload-requirements.md), attach privately to the pending application, maintain transaction failure cleanup, and expose no raw paths or self-approval. Approved address changes would follow [PSGC/maps](../maps-location-api.md). [Integration gaps](integration-gaps.md) tracks these decisions.
