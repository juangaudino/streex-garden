async function signatureInput(token: string, photoId: string, tier: string, expires: number) {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!secret) throw new Error('Missing guest media ticket configuration')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  const value = `${token.toLowerCase()}:${photoId}:${tier}:${expires}`
  return { key, value }
}

export async function guestMediaSignature(token: string, photoId: string, tier: string, expires: number) {
  const { key, value } = await signatureInput(token, photoId, tier, expires)
  const signed = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))
  return Array.from(new Uint8Array(signed), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyGuestMediaSignature(token: string, photoId: string, tier: string, expires: number, signature: string) {
  if (!Number.isInteger(expires) || expires < Math.floor(Date.now() / 1000) || expires > Math.floor(Date.now() / 1000) + 5 * 60) return false
  const expected = await guestMediaSignature(token, photoId, tier, expires)
  return expected.length === signature.length && expected === signature.toLowerCase()
}
