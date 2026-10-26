/**
 * DigiClassroom's own legacy profile fields (enhanced_user_profiles: board_type, grade_level, stream, medium,
 * language_preference) from a learning path's shared `legacy` fields. Older DigiClassroom code (materials,
 * subject matrix, Practest, the tutor) reads these; they are no longer asked at onboarding.
 */
import type { Legacy } from './rules';

export type DcpBoard = 'CBSE' | 'ICSE' | 'STATE_BOARD';
export type DcpStream = 'HUMANITIES' | 'BIOLOGY' | 'MATHEMATICS' | 'COMMERCE';

/** CBSE and CISCE are their own boards here; every other school board is a state board. Null outside school. */
export function dcpBoard(board: string | null): DcpBoard | null {
  if (!board) return null;
  if (board === 'CBSE') return 'CBSE';
  if (board === 'CISCE') return 'ICSE';
  // NIOS, IB and Cambridge are not state boards, but DigiClassroom has no closer value; their content is CBSE-like.
  if (board === 'NIOS') return 'CBSE';
  return 'STATE_BOARD';
}

/**
 * A curriculum v2 stream code (`CBSE_SCI_PCM`, `UP_BOARD_BOARD_BIPC`, `KERALA_HEC`...) as DigiClassroom's stream:
 * mathematics streams (PCM, MPC, PCMB, PCMC, PCME), biology (PCB, BiPC), commerce (COM, COMMERCE, CEC, MEC, CEBA),
 * humanities (ARTS, HUM, HEC, HEPS, SEBA). Null when there is no stream or no close match.
 */
export function dcpStream(code: string | null): DcpStream | null {
  if (!code) return null;
  const c = code.toUpperCase();
  if (/(^|_)(PCM|MPC|PCMB|PCMC|PCME)$/.test(c)) return 'MATHEMATICS';
  if (/(^|_)(PCB|BIPC)$/.test(c)) return 'BIOLOGY';
  if (/(^|_)(COM|COMMERCE|COM_MATH|CEC|MEC|CEBA)$/.test(c)) return 'COMMERCE';
  if (/(^|_)(ARTS|HUM|HEC|HEPS|SEBA)$/.test(c)) return 'HUMANITIES';
  return null;
}

/** The enhanced_user_profiles columns a learning path sets. Only the ones it knows: a null leaves the column alone. */
export function dcpProfileFields(legacy: Legacy) {
  const stream = dcpStream(legacy.stream);
  return {
    boardType: dcpBoard(legacy.board),
    gradeLevel: legacy.gradeLevel,
    stream,
    medium: legacy.medium === 'hi' ? ('HINDI' as const) : legacy.medium === 'en' ? ('ENGLISH' as const) : null,
    languagePreference: legacy.medium === 'hi' ? 'hindi' : legacy.medium === 'en' ? 'english' : null,
    specializationSubjects: stream ? [stream] : null,
  };
}
