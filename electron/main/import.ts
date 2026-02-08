import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const extractHtmlBody = (html: string) => {
  const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
  const styles = styleMatches.map((match) => match[1]).join('\n').trim()
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
  const body = bodyMatch ? bodyMatch[1] : html
  const styleTag = styles ? `<style data-imported="true">${styles}</style>` : ''
  return `${styleTag}${body}`
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
      return extractHtmlBody(iconv.decode(buffer, charset))
    } catch {
      return extractHtmlBody(buffer.toString('utf8'))
    }
  }

  if (ext === '.docx') {
    const mammoth = await import('mammoth')
    const buffer = await fs.readFile(filePath)

    let topElements: Array<{ type: 'p' | 'tbl'; alignment?: string; indent?: any; spacing?: any }> = []
    try {
      const JSZip = (await import('jszip')).default
      const zip = await JSZip.loadAsync(buffer)
      const documentXml = await zip.file('word/document.xml')?.async('string')
      if (documentXml) {
        const bodyMatch = documentXml.match(/<w:body>([\s\S]*)<\/w:body>/)
        const bodyXml = bodyMatch ? bodyMatch[1] : documentXml

        let pos = 0
        while (pos < bodyXml.length) {
          const nextP = bodyXml.indexOf('<w:p', pos)
          const nextTbl = bodyXml.indexOf('<w:tbl', pos)
          let nextPos = -1
          let nextTag = ''
          if (nextP === -1 && nextTbl === -1) break
          if (nextP === -1) { nextPos = nextTbl; nextTag = 'tbl' }
          else if (nextTbl === -1) { nextPos = nextP; nextTag = 'p' }
          else if (nextP < nextTbl) { nextPos = nextP; nextTag = 'p' }
          else { nextPos = nextTbl; nextTag = 'tbl' }

          const charAfterTag = bodyXml[nextPos + (nextTag === 'p' ? 4 : 6)]
          if (charAfterTag !== ' ' && charAfterTag !== '>' && charAfterTag !== '/') {
            pos = nextPos + 1
            continue
          }

          const closeTag = `</w:${nextTag}>`
          let depth = 1
          let searchPos = nextPos + 1
          let endPos = -1
          while (depth > 0 && searchPos < bodyXml.length) {
            const nextOpen = bodyXml.indexOf(`<w:${nextTag}`, searchPos)
            const nextClose = bodyXml.indexOf(closeTag, searchPos)
            if (nextClose === -1) break
            if (nextOpen !== -1 && nextOpen < nextClose) {
              const c = bodyXml[nextOpen + nextTag.length + 3]
              if (c === ' ' || c === '>' || c === '/') {
                depth++
              }
              searchPos = nextOpen + 1
            } else {
              depth--
              if (depth === 0) {
                endPos = nextClose + closeTag.length
              }
              searchPos = nextClose + closeTag.length
            }
          }
          if (endPos === -1) { pos = nextPos + 1; continue }

          const elementXml = bodyXml.substring(nextPos, endPos)
          pos = endPos

          if (nextTag === 'tbl') {
            topElements.push({ type: 'tbl' })
            continue
          }

          const jcMatch = elementXml.match(/<w:jc\s+w:val="([^"]+)"/)
          const indLeftMatch = elementXml.match(/<w:ind[^>]*\sw:(?:left|start)="(\d+)"/)
          const indFirstMatch = elementXml.match(/<w:ind[^>]*\sw:firstLine="(\d+)"/)
          const indHangMatch = elementXml.match(/<w:ind[^>]*\sw:hanging="(\d+)"/)
          const spacingBeforeMatch = elementXml.match(/<w:spacing[^>]*\sw:before="(\d+)"/)
          const spacingAfterMatch = elementXml.match(/<w:spacing[^>]*\sw:after="(\d+)"/)
          const spacingLineMatch = elementXml.match(/<w:spacing[^>]*\sw:line="(\d+)"/)
          const spacingRuleMatch = elementXml.match(/<w:spacing[^>]*\sw:lineRule="([^"]+)"/)
          topElements.push({
            type: 'p',
            alignment: jcMatch?.[1],
            indent: {
              left: indLeftMatch ? parseInt(indLeftMatch[1]) : undefined,
              firstLine: indFirstMatch ? parseInt(indFirstMatch[1]) : undefined,
              hanging: indHangMatch ? parseInt(indHangMatch[1]) : undefined,
            },
            spacing: {
              before: spacingBeforeMatch ? parseInt(spacingBeforeMatch[1]) : undefined,
              after: spacingAfterMatch ? parseInt(spacingAfterMatch[1]) : undefined,
              line: spacingLineMatch ? parseInt(spacingLineMatch[1]) : undefined,
              lineRule: spacingRuleMatch?.[1],
            },
          })
        }
      }
    } catch (e) {
      // ignore style extraction errors
    }

    const styleMap = [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
      "p[style-name='正文'] => p:fresh",
    ]
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        includeDefaultStyleMap: true,
        styleMap,
        ignoreEmptyParagraphs: false,
       /*  convertImage: mammoth.images.inline(async (image: any) => {
          const imageBuffer = await image.read('base64')
          return { src: `data:${image.contentType};base64,${imageBuffer}` }
        }), */
      },
    )

    let htmlOutput = result.value
    let elemIndex = 0
    let insideTable = 0

    htmlOutput = htmlOutput.replace(/<(\/?)(p|h[1-6]|table)(\s[^>]*)?(\/?)>/gi, (match, slash, tag, attrs, selfClose) => {
      const tagLower = tag.toLowerCase()
      const isClose = slash === '/'

      if (tagLower === 'table') {
        if (isClose) {
          insideTable = Math.max(0, insideTable - 1)
          return match
        }
        insideTable++
        elemIndex++
        return match
      }

      if (isClose || insideTable > 0) return match

      const styleInfo = topElements[elemIndex++]
      if (!styleInfo || styleInfo.type === 'tbl') return match

      const inlineStyles: string[] = []
      if (styleInfo.alignment) {
        const alignMap: Record<string, string> = { center: 'center', right: 'right', left: 'left', both: 'justify', justify: 'justify' }
        const align = alignMap[styleInfo.alignment]
        if (align) inlineStyles.push(`text-align:${align}`)
      }
      if (styleInfo.indent) {
        if (styleInfo.indent.left && styleInfo.indent.left > 0) {
          inlineStyles.push(`margin-left:${(styleInfo.indent.left / 20).toFixed(1)}pt`)
        }
        if (styleInfo.indent.firstLine && styleInfo.indent.firstLine > 0) {
          inlineStyles.push(`text-indent:${(styleInfo.indent.firstLine / 20).toFixed(1)}pt`)
        }
        if (styleInfo.indent.hanging && styleInfo.indent.hanging > 0) {
          inlineStyles.push(`text-indent:-${(styleInfo.indent.hanging / 20).toFixed(1)}pt`)
          if (styleInfo.indent.left && styleInfo.indent.left > 0) {
            inlineStyles.push(`padding-left:${(styleInfo.indent.left / 20).toFixed(1)}pt`)
          }
        }
      }
      if (styleInfo.spacing) {
        if (styleInfo.spacing.before && styleInfo.spacing.before > 0) {
          inlineStyles.push(`margin-top:${(styleInfo.spacing.before / 20).toFixed(1)}pt`)
        }
        if (styleInfo.spacing.after !== undefined) {
          inlineStyles.push(`margin-bottom:${(styleInfo.spacing.after / 20).toFixed(1)}pt`)
        }
        if (styleInfo.spacing.line) {
          if (styleInfo.spacing.lineRule === 'exact') {
            inlineStyles.push(`line-height:${(styleInfo.spacing.line / 20).toFixed(1)}pt`)
          } else {
            const multiplier = styleInfo.spacing.line / 240
            if (multiplier > 0) inlineStyles.push(`line-height:${multiplier.toFixed(2)}`)
          }
        }
      }

      if (inlineStyles.length === 0) return match
      const existingStyle = (attrs || '').match(/style="([^"]*)"/)
      if (existingStyle) {
        const merged = `${existingStyle[1]};${inlineStyles.join(';')}`
        const newAttrs = (attrs || '').replace(/style="[^"]*"/, `style="${merged}"`)
        return `<${tag}${newAttrs}>`
      }
      return `<${tag}${attrs || ''} style="${inlineStyles.join(';')}">`
    })

    htmlOutput = htmlOutput
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/ {2,}/g, (m: string) => `${'&nbsp;'.repeat(m.length - 1)} `)

    // 清理白色/接近白色的字体颜色，避免在白色背景上不可见
    htmlOutput = htmlOutput
      .replace(/color\s*:\s*#fff(?:fff)?\b/gi, 'color:#000')
      .replace(/color\s*:\s*white\b/gi, 'color:#000')
      .replace(/color\s*:\s*rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)/gi, 'color:#000')
      .replace(/color\s*:\s*hsl\(\s*0\s*,\s*0%?\s*,\s*100%\s*\)/gi, 'color:#000')

    return `<div class="docx-import">${htmlOutput}</div>`
  }

  if (ext === '.pdf') {
    const buffer = await fs.readFile(filePath)
    const pdfParse = require('pdf-parse/dist/node/cjs/index.cjs') as (input: Buffer) => Promise<{ text: string; numpages: number }>
    const data = await pdfParse(buffer)
    const lines = data.text.split(/\n/)
    const paragraphs: string[] = []
    let current = ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed === '') {
        if (current.trim()) {
          paragraphs.push(current.trim())
          current = ''
        }
      } else {
        current += (current ? ' ' : '') + trimmed
      }
    }
    if (current.trim()) paragraphs.push(current.trim())

    const htmlParts = paragraphs.map((p, i) => {
      const isTitle = i === 0 && p.length < 50 && !/[。！？，、；：]$/.test(p)
      if (isTitle) {
        return `<h1 style="text-align:center">${p}</h1>`
      }
      return `<p style="text-indent:2em">${p}</p>`
    })

    return `<div class="pdf-import">${htmlParts.join('\n')}</div>`
  }

  return ''
}
