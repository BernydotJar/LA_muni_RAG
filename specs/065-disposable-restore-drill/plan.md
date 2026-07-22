# Plan — Disposable logical restore drill v1

1. Validate service aliases, protected libpq files, run identity and target.
2. Fingerprint the source catalog and bounded table data.
3. Create a custom logical dump with owner/ACL excluded.
4. Force artifact permissions, calculate SHA-256 and inspect the manifest.
5. Restore into a distinct empty target with one transaction.
6. Fingerprint the target and fail on any mismatch.
7. Reapply reviewed runtime grants because ACLs are intentionally excluded.
8. Verify non-owner forced-RLS behavior and cross-tenant denial.
9. Run the compiled ProcedureCase HTTP smoke against the restored DB.
10. Record safe receipts and explicit non-proofs.

No object-store, PITR, production, staging or deployment action belongs to this
slice.
