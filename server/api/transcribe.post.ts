import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const MAX_AUDIO_SIZE = 25 * 1024 * 1024

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)

  const authorization =
    getHeader(event, 'authorization')

  const token =
    authorization?.replace(/^Bearer\s+/i, '')

  if (!token) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Authentication required'
    })
  }

  const supabase = createClient(
    config.public.supabaseUrl,
    config.public.supabasePublishableKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  )

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser(token)

  if (authError || !user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Invalid or expired session'
    })
  }

  if (!config.openaiApiKey) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'OpenAI API key is not configured'
    })
  }

  const parts = await readMultipartFormData(event)

  const audioPart = parts?.find(
    (part) => part.name === 'audio'
  )

  if (!audioPart?.data?.length) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Audio file is required'
    })
  }

  if (audioPart.data.length > MAX_AUDIO_SIZE) {
    throw createError({
      statusCode: 413,
      statusMessage:
        'Audio file exceeds the 25 MB limit'
    })
  }

  const mimeType =
    audioPart.type || 'audio/webm'

  const extension =
    mimeType.includes('mp4')
      ? 'm4a'
      : mimeType.includes('wav')
        ? 'wav'
        : 'webm'

  const audioFile = new File(
    [new Uint8Array(audioPart.data)],
    audioPart.filename ||
      `recording.${extension}`,
    {
      type: mimeType
    }
  )

  const openai = new OpenAI({
    apiKey: config.openaiApiKey
  })

  try {
    const transcription =
      await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'gpt-4o-mini-transcribe',
        language: 'de',
        response_format: 'json',
        prompt:
          'Persönlicher Tagebucheintrag auf Deutsch.'
      })

    const text = transcription.text.trim()

    if (!text) {
      throw new Error(
        'The transcription is empty'
      )
    }

    return {
      text
    }
  } catch (error) {
    console.error(
      'Audio transcription failed:',
      error
    )

    throw createError({
      statusCode: 502,
      statusMessage:
        'Die Sprachaufnahme konnte nicht erkannt werden'
    })
  }
})