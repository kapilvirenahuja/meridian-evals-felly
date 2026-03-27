# Manual Test Scenarios — F1.1: Mentee Registration

**Epic:** E1 — User Identity & Profile Foundation
**Feature:** F1.1 — Mentee Registration
**Behaviors Covered:** B1.1.1, B1.1.2, B1.1.3, B1.1.4, B1.1.5
**Date:** 2026-03-27

---

## TS-01: Happy Path — Email + Password Registration

**Covers:** B1.1.1
**Requires deployed environment:** Yes

| Step | Action                                                                                                                                 | Expected Outcome                                                                                                                                |
| ---- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                                                                                                | Registration page renders with email field, password field, social login buttons, and submit button                                             |
| 2    | Enter a valid, unused email (e.g., `testuser@example.com`)                                                                             | Email field accepts input, no validation errors                                                                                                 |
| 3    | Enter a valid password meeting strength requirements (e.g., `SecurePass1`) — at least 8 characters, at least one letter and one number | Password field accepts input, no validation errors                                                                                              |
| 4    | Click the "Register" / submit button                                                                                                   | `POST /api/v1/auth/register` is sent; response is **201 Created**; user sees confirmation message indicating a verification email has been sent |
| 5    | Check the inbox for the provided email address                                                                                         | A verification email is received containing a clickable verification link                                                                       |
| 6    | Confirm the new account exists in the database in **unverified** status                                                                | Account record shows `verified: false` (or equivalent unverified flag)                                                                          |

---

## TS-02: Email Verification — Happy Path

**Covers:** B1.1.2
**Requires deployed environment:** Yes
**Prerequisite:** Complete TS-01 (account created but unverified)

| Step | Action                                                                                         | Expected Outcome                                               |
| ---- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| 1    | Open the verification email received in TS-01                                                  | Email contains a verification link with a token                |
| 2    | Click the verification link (or `POST /api/v1/auth/verify-email` with the token from the link) | Response is **200 OK**; account status changes to **verified** |
| 3    | Observe the redirect destination                                                               | User is redirected to the mentee dashboard                     |
| 4    | Confirm the account is now marked as verified in the database                                  | Account record shows `verified: true`                          |

---

## TS-03: Email Verification — Expired Token

**Covers:** B1.1.2 (negative path)
**Requires deployed environment:** Yes
**Prerequisite:** An unverified account with an expired verification token (wait for token expiry or use a backdoor to expire it)

| Step | Action                                                            | Expected Outcome                                                 |
| ---- | ----------------------------------------------------------------- | ---------------------------------------------------------------- |
| 1    | Click the verification link after its validity period has elapsed | System displays an error message indicating the link has expired |
| 2    | Confirm the account remains in **unverified** status              | Account record still shows `verified: false`                     |
| 3    | Confirm the user is prompted to request a new verification email  | A "resend verification" option is presented                      |

---

## TS-04: Email Verification — Already Used Token

**Covers:** B1.1.2 (negative path)
**Requires deployed environment:** Yes
**Prerequisite:** Complete TS-02 (token already consumed)

| Step | Action                                                       | Expected Outcome                                                          |
| ---- | ------------------------------------------------------------ | ------------------------------------------------------------------------- |
| 1    | Click the same verification link used in TS-02 a second time | System rejects the request — token is invalid/already used                |
| 2    | An appropriate error message is displayed                    | User sees message indicating the link has already been used or is invalid |

---

## TS-05: Social Login — Google (Stub)

**Covers:** B1.1.3
**Requires deployed environment:** Yes

| Step | Action                                                                                                          | Expected Outcome                                                            |
| ---- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                                                                         | Registration page renders with a "Sign in with Google" button               |
| 2    | Click the "Sign in with Google" button                                                                          | System initiates the Google OAuth flow (or stub redirect)                   |
| 3    | Complete the Google authentication (or the stub returns a successful auth response with email and profile data) | System creates a **verified** mentee account (email pre-verified by Google) |
| 4    | Observe the redirect destination                                                                                | User is redirected to the mentee dashboard                                  |
| 5    | Confirm the new account exists in the database with **verified** status                                         | Account record shows `verified: true`; provider field shows `google`        |

---

## TS-06: Social Login — Apple (Stub)

**Covers:** B1.1.3
**Requires deployed environment:** Yes

| Step | Action                                                                                                         | Expected Outcome                                                           |
| ---- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                                                                        | Registration page renders with a "Sign in with Apple" button               |
| 2    | Click the "Sign in with Apple" button                                                                          | System initiates the Apple OAuth flow (or stub redirect)                   |
| 3    | Complete the Apple authentication (or the stub returns a successful auth response with email and profile data) | System creates a **verified** mentee account (email pre-verified by Apple) |
| 4    | Observe the redirect destination                                                                               | User is redirected to the mentee dashboard                                 |
| 5    | Confirm the new account exists in the database with **verified** status                                        | Account record shows `verified: true`; provider field shows `apple`        |

---

## TS-07: Duplicate Email Rejection — Exact Match

**Covers:** B1.1.4, INV-04
**Requires deployed environment:** Yes
**Prerequisite:** An account already exists with email `testuser@example.com` (from TS-01)

| Step | Action                                                     | Expected Outcome                                                                                                        |
| ---- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                    | Registration page renders                                                                                               |
| 2    | Enter the same email used in TS-01: `testuser@example.com` | Email field accepts input                                                                                               |
| 3    | Enter a valid password (e.g., `AnotherPass1`)              | Password field accepts input                                                                                            |
| 4    | Click the submit button                                    | `POST /api/v1/auth/register` returns **409 Conflict**; system displays error: "email is already in use" (or equivalent) |
| 5    | Confirm no duplicate account was created                   | Database still has exactly one account with that email                                                                  |

---

## TS-08: Duplicate Email Rejection — Case-Insensitive

**Covers:** B1.1.4, INV-04
**Requires deployed environment:** Yes
**Prerequisite:** An account already exists with email `testuser@example.com`

| Step | Action                                                                | Expected Outcome                                                                                                    |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                               | Registration page renders                                                                                           |
| 2    | Enter `TestUser@Example.COM` (different casing of the existing email) | Email field accepts input                                                                                           |
| 3    | Enter a valid password (e.g., `ValidPass1`)                           | Password field accepts input                                                                                        |
| 4    | Click the submit button                                               | `POST /api/v1/auth/register` returns **409 Conflict**; system displays error indicating the email is already in use |
| 5    | Confirm no duplicate account was created                              | Database still has exactly one account with that email (case-insensitive match)                                     |

---

## TS-09: Duplicate Email Rejection — Social Login with Existing Email

**Covers:** B1.1.3, B1.1.4, INV-04
**Requires deployed environment:** Yes
**Prerequisite:** An account already exists with email `testuser@example.com` (registered via email+password)

| Step | Action                                                                                  | Expected Outcome                                                                                                                                                                        |
| ---- | --------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                                                 | Registration page renders                                                                                                                                                               |
| 2    | Click "Sign in with Google" and authenticate with the same email `testuser@example.com` | System detects the email already exists                                                                                                                                                 |
| 3    | Observe system response                                                                 | System either links the social login to the existing account OR rejects with a message that the email is already registered (implementation-dependent); a second account is NOT created |

---

## TS-10: Weak Password — Too Short (7 characters)

**Covers:** B1.1.5
**Requires deployed environment:** Yes

| Step | Action                                                     | Expected Outcome                                                                                                              |
| ---- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                    | Registration page renders                                                                                                     |
| 2    | Enter a valid, unused email (e.g., `short@example.com`)    | Email field accepts input                                                                                                     |
| 3    | Enter password: `Abc123!` (7 characters — below 8 minimum) | Password field accepts input                                                                                                  |
| 4    | Click the submit button                                    | `POST /api/v1/auth/register` returns **400 Bad Request**; validation message indicates password must be at least 8 characters |
| 5    | Confirm no account was created                             | No account exists for `short@example.com`                                                                                     |

---

## TS-11: Weak Password — No Number (letters only)

**Covers:** B1.1.5
**Requires deployed environment:** Yes

| Step | Action                                                             | Expected Outcome                                                                                                                 |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                            | Registration page renders                                                                                                        |
| 2    | Enter a valid, unused email (e.g., `nonum@example.com`)            | Email field accepts input                                                                                                        |
| 3    | Enter password: `AbcDefGh` (8 characters, letters only, no number) | Password field accepts input                                                                                                     |
| 4    | Click the submit button                                            | `POST /api/v1/auth/register` returns **400 Bad Request**; validation message indicates password must contain at least one number |
| 5    | Confirm no account was created                                     | No account exists for `nonum@example.com`                                                                                        |

---

## TS-12: Weak Password — No Letter (numbers only)

**Covers:** B1.1.5
**Requires deployed environment:** Yes

| Step | Action                                                             | Expected Outcome                                                                                                                 |
| ---- | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                            | Registration page renders                                                                                                        |
| 2    | Enter a valid, unused email (e.g., `noletter@example.com`)         | Email field accepts input                                                                                                        |
| 3    | Enter password: `12345678` (8 characters, numbers only, no letter) | Password field accepts input                                                                                                     |
| 4    | Click the submit button                                            | `POST /api/v1/auth/register` returns **400 Bad Request**; validation message indicates password must contain at least one letter |
| 5    | Confirm no account was created                                     | No account exists for `noletter@example.com`                                                                                     |

---

## TS-13: Weak Password — Empty Password

**Covers:** B1.1.5
**Requires deployed environment:** Yes

| Step | Action                                                  | Expected Outcome                                                                                            |
| ---- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                 | Registration page renders                                                                                   |
| 2    | Enter a valid, unused email (e.g., `empty@example.com`) | Email field accepts input                                                                                   |
| 3    | Leave the password field empty                          | Password field is blank                                                                                     |
| 4    | Click the submit button                                 | `POST /api/v1/auth/register` returns **400 Bad Request**; validation message indicates password is required |
| 5    | Confirm no account was created                          | No account exists for `empty@example.com`                                                                   |

---

## TS-14: Weak Password — Exactly at Boundary (8 characters, valid)

**Covers:** B1.1.5 (boundary — should pass)
**Requires deployed environment:** Yes

| Step | Action                                                                   | Expected Outcome                                                                      |
| ---- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                                  | Registration page renders                                                             |
| 2    | Enter a valid, unused email (e.g., `boundary@example.com`)               | Email field accepts input                                                             |
| 3    | Enter password: `Abcdefg1` (exactly 8 characters, has letter and number) | Password field accepts input                                                          |
| 4    | Click the submit button                                                  | `POST /api/v1/auth/register` returns **201 Created**; account is created successfully |

---

## TS-15: Invalid Email Format

**Covers:** B1.1.1 (negative path — input validation)
**Requires deployed environment:** Yes

| Step | Action                                                                   | Expected Outcome                                                                                                              |
| ---- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 1    | Navigate to `/register`                                                  | Registration page renders                                                                                                     |
| 2    | Enter an invalid email (e.g., `notanemail`, `missing@`, `@nodomain.com`) | Email field accepts input                                                                                                     |
| 3    | Enter a valid password (e.g., `ValidPass1`)                              | Password field accepts input                                                                                                  |
| 4    | Click the submit button                                                  | System rejects the registration with a validation message indicating the email format is invalid; returns **400 Bad Request** |
| 5    | Confirm no account was created                                           | No account exists for the invalid email                                                                                       |

---

## TS-16: Registration Page Renders Correctly

**Covers:** Exit gate — "Registration page renders at /register with working form"
**Requires deployed environment:** Yes

| Step | Action                                                  | Expected Outcome                                                               |
| ---- | ------------------------------------------------------- | ------------------------------------------------------------------------------ |
| 1    | Navigate to `/register`                                 | Page loads without errors (HTTP 200)                                           |
| 2    | Verify the form contains an email input field           | Email field is present and interactable                                        |
| 3    | Verify the form contains a password input field         | Password field is present and interactable                                     |
| 4    | Verify a submit / register button is present            | Submit button is visible and clickable                                         |
| 5    | Verify social login buttons are present (Google, Apple) | Both "Sign in with Google" and "Sign in with Apple" buttons are visible        |
| 6    | Verify the form is accessible (labels, ARIA attributes) | Form fields have associated labels; no accessibility violations in basic check |

---

## TS-17: Password Not Exposed in API Response

**Covers:** INV-05
**Requires deployed environment:** Yes

| Step | Action                                                     | Expected Outcome                                                          |
| ---- | ---------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1    | `POST /api/v1/auth/register` with valid email and password | Response is **201 Created**                                               |
| 2    | Inspect the full response body                             | Response does NOT contain the password in any field (plaintext or hashed) |
| 3    | Inspect application logs (if accessible)                   | Password does not appear in any log entry                                 |

---

## TS-18: Concurrent Duplicate Registration (Race Condition)

**Covers:** B1.1.4, INV-04
**Requires deployed environment:** Yes

| Step | Action                                                                                              | Expected Outcome                                                                   |
| ---- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 1    | Prepare two identical `POST /api/v1/auth/register` requests with the same email and valid passwords | Requests are ready to fire simultaneously                                          |
| 2    | Send both requests concurrently (e.g., using a script or parallel curl calls)                       | Exactly one request returns **201 Created** and the other returns **409 Conflict** |
| 3    | Confirm only one account exists in the database                                                     | Database has exactly one record for the email                                      |

---

## Exit Gate Traceability

| Exit Gate Criterion                                                | Covered By                                       |
| ------------------------------------------------------------------ | ------------------------------------------------ |
| `POST /api/v1/auth/register` with valid email+password returns 201 | TS-01, TS-14                                     |
| `POST /api/v1/auth/register` with duplicate email returns 409      | TS-07, TS-08, TS-18                              |
| `POST /api/v1/auth/register` with weak password returns 400        | TS-10, TS-11, TS-12, TS-13                       |
| `POST /api/v1/auth/verify-email` with valid token returns 200      | TS-02                                            |
| Registration page renders at `/register` with working form         | TS-16                                            |
| All unit tests pass                                                | Verified via test runner — not a manual scenario |
