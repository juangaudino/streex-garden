export class R2RequestError extends Error {
  constructor(readonly statusCode: number, readonly code?: string) {
    super(`R2 request failed (${statusCode})`)
    this.name = 'R2RequestError'
  }
}

export function r2ObjectUrl(endpoint: string, bucket: string, key: string) {
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/')
  return `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(bucket)}/${encodedKey}`
}

export async function signedR2Request(
  signedFetch: (input: string, init?: RequestInit) => Promise<Response>,
  input: { endpoint: string; bucket: string; method: 'DELETE' | 'GET' | 'HEAD' | 'PUT'; key: string; headers?: HeadersInit; body?: BodyInit },
) {
  const response = await signedFetch(r2ObjectUrl(input.endpoint, input.bucket, input.key), {
    method: input.method,
    headers: input.headers,
    body: input.body,
  })
  if (response.ok) return response
  const errorBody = await response.text().catch(() => '')
  const code = errorBody.match(/<Code>([^<]+)<\/Code>/i)?.[1]
  throw new R2RequestError(response.status, code)
}
