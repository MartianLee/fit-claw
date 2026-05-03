const encoder = new TextEncoder()

export async function hashToken(token: string): Promise<string> {
  const data = encoder.encode(token)
  const buffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export async function verifyToken(token: string, hash: string): Promise<boolean> {
  return (await hashToken(token)) === hash
}
