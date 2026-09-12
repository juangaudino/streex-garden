import { filmFrameAt, type FilmComposition } from './growth-film-composition'

export type FilmImage = ImageBitmap | HTMLImageElement
export interface FilmTypography { serif: string; sans: string }

/** One geometry for canvas preview and encoded video. The photograph is never cropped. */
export function containFilmImage(sourceWidth: number, sourceHeight: number, width: number, height: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0) throw new Error('La fotografía no tiene dimensiones válidas.')
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  return { x: (width - sourceWidth * scale) / 2, y: (height - sourceHeight * scale) / 2, width: sourceWidth * scale, height: sourceHeight * scale }
}

/** Wrap long notes, names and unbroken words without overflowing the video. */
export function filmTextLines(text: string, maxWidth: number, maxLines: number, measure: (text: string) => number): string[] {
  if (!text.trim() || maxLines < 1) return []
  const words = text.replace(/\s+/gu, ' ').trim().split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if (line && measure(`${line} ${word}`) <= maxWidth) { line += ` ${word}`; continue }
    if (line) lines.push(line)
    line = ''
    for (const letter of word) {
      if (line && measure(line + letter) > maxWidth) { lines.push(line); line = '' }
      line += letter
    }
  }
  if (line) lines.push(line)
  if (lines.length > maxLines) {
    lines.length = maxLines
    let last = [...lines[maxLines - 1]]
    while (last.length && measure(last.join('') + '…') > maxWidth) last = last.slice(0, -1)
    lines[maxLines - 1] = last.join('') + '…'
  }
  return lines
}

function drawMoment(context: CanvasRenderingContext2D, plan: FilmComposition, index: number, image: FilmImage, typography: FilmTypography) {
  const { width, height } = plan
  const moment = plan.moments[index]
  context.fillStyle = '#0b130e'
  context.fillRect(0, 0, width, height)
  const box = containFilmImage('naturalWidth' in image ? image.naturalWidth : image.width, 'naturalHeight' in image ? image.naturalHeight : image.height, width, height)
  context.drawImage(image, box.x, box.y, box.width, box.height)
  context.textAlign = 'left'
  context.textBaseline = 'top'
  const measure = (text: string) => context.measureText(text).width

  // Garden films identify the plant and its cycle even when editorial titles are hidden.
  if (plan.scope.kind === 'garden') {
    context.font = `500 23px ${typography.sans}`
    const labels = filmTextLines(`${moment.cropName} · ${moment.cycleLabel}`, width - 88, 2, measure)
    const gradient = context.createLinearGradient(0, 0, 0, 170)
    gradient.addColorStop(0, '#0b130eee'); gradient.addColorStop(1, '#0b130e00')
    context.fillStyle = gradient; context.fillRect(0, 0, width, 170)
    context.fillStyle = '#e9eedb'
    labels.forEach((line, i) => context.fillText(line, 44, 34 + i * 31))
  }
  if (!plan.titles) return
  context.font = `400 52px ${typography.serif}`
  const title = filmTextLines(moment.title, width - 88, 3, measure)
  context.font = `400 25px ${typography.sans}`
  const detail = filmTextLines(moment.detail ?? '', width - 88, 3, measure)
  const blockHeight = 30 + 24 + title.length * 58 + (detail.length ? 18 + detail.length * 34 : 0)
  const top = height - 56 - blockHeight
  const gradient = context.createLinearGradient(0, Math.max(0, top - 110), 0, height)
  gradient.addColorStop(0, '#14241600'); gradient.addColorStop(.4, '#142416bd'); gradient.addColorStop(1, '#142416f5')
  context.fillStyle = gradient; context.fillRect(0, Math.max(0, top - 110), width, height)
  context.fillStyle = '#cedfbb'; context.font = `500 20px ${typography.sans}`
  context.fillText('GARDEN X', 44, top)
  context.fillStyle = '#f0f7e4'; context.font = `400 52px ${typography.serif}`
  title.forEach((line, i) => context.fillText(line, 44, top + 54 + i * 58))
  context.fillStyle = '#d3dec8'; context.font = `400 25px ${typography.sans}`
  detail.forEach((line, i) => context.fillText(line, 44, top + 54 + title.length * 58 + 18 + i * 34))
}

/** Render complete scenes into scratch canvases before blending, so captions and photo agree. */
export function createFilmPainter(plan: FilmComposition, images: readonly FilmImage[], typography: FilmTypography) {
  if (images.length !== plan.moments.length) throw new Error('Faltan fotografías para esta composición.')
  const layers = [document.createElement('canvas'), document.createElement('canvas')]
  const contexts = layers.map(canvas => {
    canvas.width = plan.width; canvas.height = plan.height
    const context = canvas.getContext('2d', { alpha: false })
    if (!context) throw new Error('No se pudo preparar la composición del video.')
    return context
  })
  const cached = [-1, -1]
  return (context: CanvasRenderingContext2D, timeMs: number) => {
    const frame = filmFrameAt(plan, timeMs)
    const indexes = [frame.index, frame.nextIndex]
    indexes.forEach((index, layer) => {
      if (index !== null && cached[layer] !== index) {
        drawMoment(contexts[layer], plan, index, images[index], typography)
        cached[layer] = index
      }
    })
    context.save()
    context.globalAlpha = 1
    context.drawImage(layers[0], 0, 0, context.canvas.width, context.canvas.height)
    if (frame.nextIndex !== null) {
      context.globalAlpha = frame.blend
      context.drawImage(layers[1], 0, 0, context.canvas.width, context.canvas.height)
    }
    context.restore()
  }
}
