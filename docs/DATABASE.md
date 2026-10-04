# Database

Schema is reproducible from timestamped migrations. `seed.sql` intentionally has no sample records or credentials. A default grade scheme is reference configuration and belongs in the migration.

| Table                       | Purpose                                                             |
| --------------------------- | ------------------------------------------------------------------- |
| profiles                    | Auth user role, name, active status                                 |
| academic_terms              | Academic year and term; unique year/name, one active term           |
| classes                     | Reusable class names and active status                              |
| students                    | Text student number, names and active status                        |
| enrollments                 | Unique student/term assignment to a class                           |
| subjects                    | Bilingual subject catalog                                           |
| subject_offerings           | Term/class course, numeric/pass-fail mode and grade configuration   |
| grade_schemes               | Named scheme versions                                               |
| grade_scheme_rules          | Unique lower percentage bounds and points                           |
| student_grades              | Authoritative score/result, draft/publication state and row version |
| audit_logs                  | Actor/action/before/after/time, readable only by administrators     |
| private.student_credentials | Bcrypt PINs; never exposed in Data API                              |
| private.student_sessions    | Hashed opaque student tokens and expiries                           |
| private.rate_limits         | Atomic fixed-window counters keyed by HMAC                          |

UUID foreign keys restrict deletion of academic history. Students can be deactivated. Changing their name updates current identity display; it does not rewrite saved scores. Subject names and class labels remain editable labels. Graded term identity, offering configuration, and enrollment assignment cannot change. Schemes used by an offering are immutable; create a new version.

## Grade calculation

Thresholds are lower bounds, not independently editable ranges. The first is 0, every bound is unique in [0,100], and the upper bound is implicitly the next threshold. Therefore overlaps and gaps cannot be represented. The final range includes 100. Scores are normalized as `score × 100 / maximum` using PostgreSQL numeric. Up to two decimal places are accepted. The default scheme maps 79 and 79.99 to 3.5; 80 to 4.0.

Automatic pass/fail compares `score × 100 >= threshold × maximum`. Manual pass/fail requires PASS or FAIL and stores no score. Pass/fail is excluded from GPA in V1. GPA weights only PUBLISHED numeric grades where `include_in_gpa` is true and credits are positive. It returns no value for zero eligible credits and rounds to two decimal places.

## Transactions and concurrency

`manage_record`, `import_students`, `save_grades`, and `publish_grades` are transactional. Imports never upsert an existing student number. All changed rows and publication requests carry the prior grade version. A stale version rejects the entire batch with a conflict. Saving a published result makes it draft and clears published_at. Publication increments versions and records an audit change.

## Operations

Use `supabase db reset --local` only for disposable local development. Use `supabase migration up --local` to add local migrations without reset. Review `supabase db push --dry-run` before remote application. Never use remote resets to troubleshoot development.

## Migration 010

Adds term/class homeroom assignments and profile Thai names/private avatar paths; extends existing scoped RLS rather than adding table write grants. New RPCs manage authorized existing-student updates, explicit archive/purge, optimistic grade clear, neighbors and atomic subject+offerings creation. Auth account cascades remove teacher-owned profile/assignment/feedback data and clear grade authors. Reset proofs cascade with deleted terms/profiles. Private Storage bucket stores reencoded teacher photos. No existing academic records are rewritten by this migration.

Migration 011 adds `admin_update_teacher(uuid,timestamptz,jsonb)`: active administrators may correct a TEACHER's official Thai/English names, display name, nickname and contact fields. It locks the profile and requires the current `updated_at`, rejecting stale updates with 40001. Payload keys/types are checked in PostgreSQL as well as the HTTP schema. Auth identity, login, role, active state, photo, onboarding, assignments and academic rows are outside this mutation. The existing profile UPDATE audit trigger applies. Anonymous execution and direct authenticated table writes remain unavailable; the self-profile RPC still locks official names.
