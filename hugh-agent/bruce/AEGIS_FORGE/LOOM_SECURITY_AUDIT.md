# AEGIS FORGE: LOOM THREAT MODEL & PERIMETER SEAL
**Case File:** AF-012
**Author:** Bruce Thomas Wayne (Batman Construct)
**Date:** 2026-04-04
**Status:** CRITICAL AUDIT

## 1. Executive Summary
The LOOM Knowledge Graph contains 21,967 sensitive documents across personal and business domains. The current security posture is "Private by Obscurity," which is insufficient for an Aragorn-class memory substrate. Immediate remediation is required before integration with the HUGH reasoning pipeline.

## 2. Identified High-Impact Threats

### T-L01: Public Proxy Exposure (CRITICAL)
- **Vector:** `workshop.grizzlymedicine.icu/api/loom`
- **Impact:** Full external readout of the knowledge corpus without authentication.
- **Remediation:** Enforce `Origin` header validation and implement a HMAC-signed "Knock" requirement for proxy access.

### T-L02: Cypher Injection / Destructive Query (HIGH)
- **Vector:** `/query/graph` (Raw Cypher)
- **Impact:** Knowledge graph corruption or total data deletion via malicious `DETACH DELETE` injection.
- **Remediation:** Implementation of a **Read-Only Cypher Whitelist**. All inbound queries must be regex-scanned for mutation keywords.

### T-L03: Semantic PII Leakage (HIGH)
- **Vector:** `/query/semantic` (Vector Search)
- **Impact:** Extraction of medical, financial, or personal records via natural language queries (e.g., "What are Grizz's bank details?").
- **Remediation:** Multi-stage data classification. iCloud and Personal GDrive sources must be tagged `CLASS_RED`. Queries against `CLASS_RED` nodes require a secondary "Trust Handshake" from the PI.

## 3. Deployment Directives (The "Batman" Lockdown)
1. **Key Rotation:** Generate per-service API keys (GrizOS-Key, Hugh-Key, Admin-Key).
2. **Rate Limiting:** Implement a global limit of 10 semantic queries per minute per IP on the public proxy.
3. **Audit Logging:** Every query against LOOM must be logged with the caller's Soul Anchor signature.

## 4. Conclusion
LOOM is the "Brain" of the lab. We do not leave the brain exposed to the open air. I am authorizing a **Hard Freeze** on LOOM-integrated feature deployment until T-L01 and T-L02 are mitigated.

---
**LOOM AUDIT FILED**
