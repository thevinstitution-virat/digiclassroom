/**
 * Canonical email normalisation.
 *
 * MySQL's `utf8mb4_0900_ai_ci` collation compares case-insensitively, so today
 * `Foo@Bar.com` and `foo@bar.com` are the same address to every lookup and unique
 * constraint. **Postgres does not do this.** On a plain `varchar` the two strings
 * are distinct values, which would mean:
 *
 *   - a user who registered as `Foo@Bar.com` cannot sign in as `foo@bar.com`, and
 *   - better-auth's link-by-email would MISS the existing account and provision a
 *     duplicate instead of linking — stranding that user's courses, notes and
 *     progress on an orphan row.
 *
 * On Postgres the primary defence is the `citext` column type, which restores
 * case-insensitive comparison in the database. Normalising at write is the second
 * line, keeping stored data canonical so correctness does not hinge on which
 * columns were remembered.
 *
 * Only case and surrounding whitespace are touched — deliberately NOT dots or
 * `+tags`, which are Gmail conventions and would merge distinct addresses
 * elsewhere.
 */
export function normaliseEmail(email: string): string {
    return email.trim().toLowerCase();
}
