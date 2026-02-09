import { createDomFromElementList, getElementListByHTML } from '@hufe921/canvas-editor'

type EditorData = {
  header?: Array<{ value?: string }>
  main?: Array<{ value?: string }>
  footer?: Array<{ value?: string }>
}

const emptyData = (): EditorData => ({ main: [{ value: '' }] })

const normalizeData = (data?: EditorData | null): EditorData => {
  if (!data || !Array.isArray(data.main) || data.main.length === 0) {
    return emptyData()
  }
  return { main: data.main }
}

export const createEmptyEditorContent = () => JSON.stringify(emptyData())

const safeGetElementListByHTML = (html: string) => {
  if (typeof document === 'undefined') {
    return [{ value: html }]
  }
  const sandbox = document.createElement('div')
  const body = document.body
  const originalAppend = body.appendChild.bind(body)
  try {
    (body as any).appendChild = (node: Node) => sandbox.appendChild(node) as any
    const innerWidth = document.documentElement?.clientWidth || window.innerWidth || 1024
    return getElementListByHTML(html, { innerWidth })
  } finally {
    (body as any).appendChild = originalAppend
    if (sandbox.parentNode) {
      sandbox.parentNode.removeChild(sandbox)
    }
  }
}

export const parseEditorData = (raw: string): EditorData => {
  if (!raw) return emptyData()
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return { main: parsed.length ? parsed : [{ value: '' }] }
    }
    if (parsed && typeof parsed === 'object') {
      const data = parsed as EditorData
        const main = Array.isArray(data.main) && data.main.length ? data.main : [{ value: '' }]
        return { main }
    }
  } catch {
    if (raw.trim().startsWith('<')) {
      try {
        let cleaned = raw
        cleaned = cleaned.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
        if (bodyMatch) cleaned = bodyMatch[1]
        cleaned = cleaned.replace(/<div[^>]*class=["']docx-import["'][^>]*>([\s\S]*?)<\/div>/gi, '$1')
        const list = safeGetElementListByHTML(cleaned)
        return { main: list.length ? list : [{ value: '' }] }
      } catch {
        // fallthrough
      }
    }
    return { main: [{ value: raw }] }
  }
  return emptyData()
}

export const serializeEditorData = (data: EditorData) => JSON.stringify(normalizeData(data))

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const extractEditorText = (raw: string) => {
  const data = parseEditorData(raw)
  const blocks = [...(data.main ?? [])]
  const text = blocks.map((block) => (typeof block?.value === 'string' ? block.value : '')).join(' ')
  return stripHtml(text)
}

export const renderEditorHtml = (raw: string) => {
  const data = parseEditorData(raw)
  try {
    const dom = createDomFromElementList(data.main ?? [])
    return dom.innerHTML || ''
  } catch {
    return ''
  }
}
