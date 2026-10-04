# Public source release

This public release contains application source, dependency manifests, database migrations, fictional local fixtures/tests and user/developer documentation. It contains no school database export, uploaded photos, spreadsheets, real account credentials or original Git history.

The original private development history contains personal author metadata and is intentionally not published. Do not push its branches or tags to this public repository. Make future public updates in a clone of the public repository, or export a fresh reviewed source snapshot and apply it without importing the private Git history.

Before publishing updates, inspect both file contents and commit author metadata. Exclude `.local`, `.env*` except placeholder `.env.example`, `.vercel`, `ops`, uploaded files, screenshots, private planning notes and build/test artifacts. Review test fixtures for real names and contact information. Only fictional fixtures belong in source control. Never run tests against a real school database.

The public application source does not make the hosted database public. Login, assigned permissions and database row-level security still control access. A fresh installation needs its own database, hosting secrets and administrator account; no live credentials are supplied.
