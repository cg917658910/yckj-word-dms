import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const cleanHtml = (html: string) => {
    return html
}

export const toHtmlFromFile = async (filePath: string) => {
  const fs = await import('node:fs/promises')
  const pathMod = await import('node:path')
  const ext = pathMod.extname(filePath).toLowerCase()

  if (ext === '.html' || ext === '.htm') {
    const buffer = await fs.readFile(filePath)
    const head = buffer.slice(0, 4096).toString('ascii')
    const match =
      head.match(/charset\s*=\s*["']?([^"'>\s]+)/i) ||
      head.match(/content-type[^>]*charset=([^"'>\s]+)/i)
    const raw = (match?.[1] || 'utf-8').toLowerCase()
    const charset = raw.includes('gb') ? 'gbk' : raw
    try {
      const iconv = require('iconv-lite') as { decode: (buf: Buffer, enc: string) => string }
      return cleanHtml(iconv.decode(buffer, charset))
    } catch {
      return cleanHtml(buffer.toString('utf8'))
    }
  }

  if (ext === '.docx') {
    const mammoth = await import('mammoth')
    const buffer = await fs.readFile(filePath)
    const result = await mammoth.convertToHtml({ buffer })
    return cleanHtml(result.value || '')
  }

  if (ext === '.pdf') {
    // 提示PDF开发中
      const { dialog } = await import('electron')
      await dialog.showMessageBox({
        type: 'info',
        title: '功能开发中',
        message: 'PDF 文件的导入功能正在开发中，敬请期待！',
      })
      return ''
  }

  return ''
}


