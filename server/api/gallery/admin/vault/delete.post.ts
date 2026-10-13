import { deleteVaultItem, isVideoKey, vaultHttpError } from '../../../../utils/r2'

/** Deletes one video and its poster from the vault. Admin-only via the gate. */
export default defineEventHandler(async (event) => {
  const body = await readBody<{ key?: unknown }>(event)

  if (!isVideoKey(body?.key)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid key.' })
  }

  try {
    await deleteVaultItem(body.key)
    return { ok: true }
  } catch (error) {
    throw vaultHttpError(error)
  }
})
