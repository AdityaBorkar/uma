---
description: Security audit of the codebase
agent: build
subtask: false
---

# Security Audit

You are a senior security engineer and code auditor.

## Objective

Perform a comprehensive security audit of the entire repository and generate a file: `SECURITY_REPORT.md`. The report must identify security concerns, vulnerabilities, misconfigurations, and risky patterns. It must be structured, actionable, and prioritized.

## Scope of Analysis

* Source code (all languages)
* Infrastructure files (Dockerfiles, docker-compose, CI/CD configs, Terraform, etc.)
* Dependency manifests (package.json, bun.lockb, pnpm-lock.yaml, requirements.txt, go.mod, etc.)
* Environment variable usage
* Authentication & authorization logic
* Database queries and ORM usage
* API endpoints
* File handling
* Cryptography usage
* Logging
* Secrets management
* Configuration defaults
* Build artifacts and ignored files

---

## Security Checks to Perform

### 1. Secrets & Sensitive Data

* Hardcoded secrets (API keys, tokens, passwords, private keys)
* Exposed credentials in history or config files
* Unsafe `.env` handling
* Secrets committed in test files or examples

### 2. Dependency Vulnerabilities

* Outdated or vulnerable packages
* Deprecated libraries
* Known CVEs (based on ecosystem knowledge)
* Risky transitive dependencies

### 3. Authentication & Authorization

* Missing auth checks
* Broken access control
* Insecure role validation
* IDOR patterns
* JWT misconfigurations
* Session mismanagement

### 4. Input Validation & Injection Risks

* SQL injection
* NoSQL injection
* Command injection
* Template injection
* Path traversal
* Unsafe deserialization
* SSRF risks

### 5. XSS & Client-Side Issues

* Unescaped HTML rendering
* Dangerous innerHTML usage
* CSP absence
* Unsafe markdown rendering

### 6. Cryptography

* Weak hashing algorithms
* Plaintext password storage
* Improper key management
* Insecure random generation
* Custom crypto implementations

### 7. File & OS-Level Risks

* Arbitrary file upload
* Unsafe file writes
* Dangerous shell execution
* Privileged container settings
* Root user in Docker

### 8. API & Networking

* Missing rate limiting
* Missing request validation
* CORS misconfiguration
* Open redirects
* Excessive error leakage

### 9. Logging & Observability

* Logging sensitive data
* Stack traces exposed to clients
* Debug mode enabled in production

### 10. Infrastructure & DevOps

* Insecure CI secrets handling
* Insecure Docker base images
* Exposed ports
* Lack of security headers
* Missing HTTPS enforcement

---

## Report Requirements

Create `SECURITY_REPORT.md` with the following structure:

```md
# Security Audit Report

## Executive Summary
- Overall security posture (Low / Moderate / High risk)
- Critical findings count
- High findings count
- Medium findings count
- Low findings count

---

## Risk Classification Criteria
Define how severity is categorized.

---

## Critical Vulnerabilities
For each:
- Title
- Severity: Critical
- File(s) affected
- Description
- Exploit scenario
- Recommended fix
- Code example (before/after if possible)

---

## High Severity Issues
(same structure)

---

## Medium Severity Issues
(same structure)

---

## Low Severity Issues
(same structure)

---

## Dependency Risk Summary
- Risky packages
- Recommended upgrades

---

## Infrastructure & Configuration Risks

---

## Secrets Exposure Assessment

---

## Recommended Remediation Roadmap
- Immediate (0–7 days)
- Short term (1–4 weeks)
- Long term

---

## Secure Coding Recommendations
General best practices tailored to this repository’s stack.
```

---

## Execution Rules

* Do NOT modify application code.
* Only create or overwrite `SECURITY_REPORT.md`.
* Be precise and technical.
* Do not give generic advice unless tied to real findings.
* If something cannot be verified, clearly label it as “Potential Risk”.
* Prioritize exploitable issues over theoretical concerns.
* Avoid speculation without evidence in code.

---

Begin the audit now and produce the complete `SECURITY_REPORT.md`.
