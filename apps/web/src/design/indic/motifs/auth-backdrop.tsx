/* GENERATED — canonical: PDLMS_Pro/shared/design/indic/auth-backdrop.tsx
   DO NOT EDIT HERE. Edit the canonical file and re-run sync-indic.mjs.
   sha256:65bf8a01ccfd9068 */
import { LotusMandala } from "./lotus-mandala";
import styles from "./auth-backdrop.module.css";

/** Shared class for the parchment auth card — apply to <EnhancedCard>. */
export const authCardClassName = styles.card;

/** Shared brass-shimmer halo class — apply to the logo wrapper. */
export const authLogoHaloClassName = styles.iconHalo;

/**
 * AuthBackdrop — the shared saffron-cream page frame for every auth screen,
 * with the large lotus mandala centred behind the card. Wrap the page's card
 * (given `authCardClassName`) as the child.
 */
export function AuthBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.page}>
      <div className={`${styles.glow} ${styles.glowTop}`} />
      <div className={`${styles.glow} ${styles.glowBottom}`} />
      <LotusMandala className={styles.mandala} />
      {children}
    </div>
  );
}
