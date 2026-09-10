import type { SupabaseClient } from 'npm:@supabase/supabase-js@2.115.0'
import type { AiProviderAdapter, AiProviderRequest } from './ai-provider.ts'
import { readAuthorizedPhoto } from './private-photo.ts'

const maxPhotoBytes = 5 * 1024 * 1024

function base64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  return btoa(binary)
}

export async function runAiCheckRuntime(input: {
  userClient: SupabaseClient
  storageClient: SupabaseClient
  ownerId: string
  growCycleId: string
  photoId: string
  comparePhotoId?: string | null
  provider: AiProviderAdapter
  standardVersion: string
  promptVersion: string
  jsonSchema?: Record<string, unknown>
}): Promise<{ providerRequest: AiProviderRequest; context: Record<string, unknown> }> {
  const { data, error } = await input.userClient.rpc('garden_get_ai_cycle_context', {
    p_grow_cycle_id: input.growCycleId,
    p_photo_id: input.photoId,
    p_compare_photo_id: input.comparePhotoId ?? null,
  })
  if (error || !data || typeof data !== 'object') throw new Error('Authorized AI context is unavailable')
  const context = data as Record<string, unknown>
  const selected = context.selected_photo
  if (!selected || typeof selected !== 'object') throw new Error('Selected photo metadata is unavailable')
  const photo = selected as { id?: unknown; storage_path?: unknown; content_type?: unknown; byte_size?: unknown }
  if (photo.id !== input.photoId || typeof photo.storage_path !== 'string' || typeof photo.content_type !== 'string' || typeof photo.byte_size !== 'number') throw new Error('Selected photo metadata is invalid')
  if (photo.byte_size > maxPhotoBytes) throw new Error('Selected photo exceeds the AI image limit')
  const downloaded = await readAuthorizedPhoto(input.storageClient, input.ownerId, {
    id: input.photoId,
    storage_path: photo.storage_path,
    content_type: photo.content_type,
    byte_size: photo.byte_size,
  })
  const providerRequest: AiProviderRequest = {
    operation: 'ai_check',
    context: { ...context, selected_photo: { ...photo, storage_path: undefined } },
    imageDataUrl: `data:${downloaded.contentType};base64,${base64(downloaded.bytes)}`,
    standardVersion: input.standardVersion,
    promptVersion: input.promptVersion,
    jsonSchema: input.jsonSchema,
  }
  return { providerRequest, context }
}
