/* eslint-disable no-restricted-syntax -- this test sets the storage settings the module reads */
// A storage refusal names itself on the learner's screen (13 Nov 2026: Study Buddy uploads failed as a bare "Upload failed. Please try
// again.", and the cause could only be found in the server log). Names such as AccessDenied are shown; secrets and the full error are not.

const send = jest.fn()
jest.mock('../../../../../packages/core/src/lib/services/r2', () => ({ r2Client: { send: (...a: unknown[]) => send(...a) } }))

import { getHwObject, putHwObject } from '@/lib/hw/storage/r2'

const KEY = 'hw-assignments/org/a/s/q/photo.v1.jpg'

describe('answer storage errors', () => {
  beforeAll(() => Object.assign(process.env, { R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'id', R2_SECRET_ACCESS_KEY: 'secret-value', R2_BUCKET_NAME: 'bucket' }))
  beforeEach(() => { send.mockReset(); delete process.env.HW_DEV_LOCAL_STORAGE_DIR })

  it('a refused upload says which refusal it was, and keeps the details for the log', async () => {
    send.mockRejectedValue(Object.assign(new Error('Access Denied for secret-value'), { name: 'AccessDenied', $metadata: { httpStatusCode: 403 } }))
    const e = await putHwObject(KEY, new Uint8Array([1]), 'image/jpeg').catch((x) => x)
    expect(e).toMatchObject({ code: 'PROVIDER_ERROR', publicMessage: 'File storage did not accept this (AccessDenied). Please try again later.' })
    expect(e.publicMessage).not.toContain('secret')
    expect(e.message).toContain('HTTP 403')
  })

  it('a missing bucket on reading is named too; storage that works is untouched', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('The specified bucket does not exist'), { name: 'NoSuchBucket' }))
    await expect(getHwObject(KEY)).rejects.toMatchObject({ publicMessage: expect.stringContaining('NoSuchBucket') })
    send.mockResolvedValueOnce({})
    await expect(putHwObject(KEY, new Uint8Array([1]), 'image/jpeg')).resolves.toBeUndefined()
  })

  it('missing settings still say the storage is not configured', async () => {
    const saved = process.env.R2_BUCKET_NAME
    delete process.env.R2_BUCKET_NAME
    await expect(putHwObject(KEY, new Uint8Array([1]), 'image/jpeg')).rejects.toMatchObject({ code: 'NOT_CONFIGURED' })
    process.env.R2_BUCKET_NAME = saved
  })
})
