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
  instructions?: string
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
  const comparison = context.comparison_photo
  const comparisonPhoto = input.comparePhotoId
    ? comparison && typeof comparison === 'object'
      ? comparison as { id?: unknown; storage_path?: unknown; content_type?: unknown; byte_size?: unknown }
      : null
    : null
  if (input.comparePhotoId && (!comparisonPhoto || comparisonPhoto.id !== input.comparePhotoId || typeof comparisonPhoto.storage_path !== 'string' || typeof comparisonPhoto.content_type !== 'string' || typeof comparisonPhoto.byte_size !== 'number')) throw new Error('Comparison photo metadata is invalid')
  const comparisonByteSize = comparisonPhoto?.byte_size as number | undefined
  if (comparisonByteSize !== undefined && comparisonByteSize > maxPhotoBytes) throw new Error('Comparison photo exceeds the AI image limit')
  const comparisonDownloaded = comparisonPhoto
    ? await readAuthorizedPhoto(input.storageClient, input.ownerId, {
      id: input.comparePhotoId!,
      storage_path: comparisonPhoto.storage_path as string,
      content_type: comparisonPhoto.content_type as string,
      byte_size: comparisonByteSize!,
    })
    : null
  const contextWithoutPaths = {
    ...context,
    selected_photo: { ...photo, storage_path: undefined },
    ...(comparisonPhoto ? { comparison_photo: { ...comparisonPhoto, storage_path: undefined } } : {}),
  }
  const providerRequest: AiProviderRequest = {
    operation: 'ai_check',
    context: contextWithoutPaths,
    imageDataUrl: `data:${downloaded.contentType};base64,${base64(downloaded.bytes)}`,
    ...(comparisonDownloaded ? { imageDataUrls: [`data:${downloaded.contentType};base64,${base64(downloaded.bytes)}`, `data:${comparisonDownloaded.contentType};base64,${base64(comparisonDownloaded.bytes)}`] } : {}),
    standardVersion: input.standardVersion,
    promptVersion: input.promptVersion,
    jsonSchema: input.jsonSchema,
    instructions: input.instructions,
  }
  return { providerRequest, context }
}
