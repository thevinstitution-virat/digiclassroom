// Sarvam reader: interface and configuration only in Phase 1. Phase 2 implements it against
// Sarvam's current Document Intelligence docs (async job, page limits, per-language routes).

import { getHwConfig } from '../config';
import { HwError } from '../errors';
import type { HandwritingReader, ReadInput, ReadResult } from './types';

export class SarvamReader implements HandwritingReader {
  readonly id = 'sarvam:unimplemented';

  constructor(readonly tier: 1 | 2) {}

  get configured(): boolean {
    return Boolean(getHwConfig().SARVAM_API_KEY);
  }

  async read(_input: ReadInput): Promise<ReadResult> {
    throw new HwError('NOT_CONFIGURED', 'The Sarvam reader is not enabled yet.', 'SarvamReader is not implemented in Phase 1');
  }
}
