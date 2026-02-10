import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import path from 'node:path';
import { ensureUniquePath, extractInlineStyles, normalizeHtml, readCkeditorCss } from './utils';

const buildExportHtml = async (payload: { title: string; content: string }) => {
  const extracted = extractInlineStyles(payload.content || '')
  let bodyHtml = normalizeHtml(extracted.body)

  bodyHtml = bodyHtml
    .replace(/<table(\s[^>]*)?>/gi, (match, attrs) => {
      const hasStyle = /style\s*=/i.test(attrs || '')
      if (hasStyle) {
        return match.replace(/style\s*=\s*"([^"]*)"/i, 'style="$1;border-collapse:collapse;width:100%"')
      }
      return `<table${attrs || ''} style="border-collapse:collapse;width:100%">`
    })
    .replace(/<(td|th)(\s[^>]*)?>/gi, (match, tag, attrs) => {
      const borderStyle = 'border:1px solid #000;padding:2px 3px;font-size:10.5pt;line-height:1.15'
      const hasStyle = /style\s*=/i.test(attrs || '')
      if (hasStyle) {
        return match.replace(/style\s*=\s*"([^"]*)"/i, `style="$1;${borderStyle}"`)
      }
      return `<${tag}${attrs || ''} style="${borderStyle}">`
    })

  // 压缩表格单元格内的空段落：保留空行但让高度更合理
  bodyHtml = bodyHtml.replace(
    /(<td[^>]*>)([\s\S]*?)(<\/td>)/gi,
    (match, open, content, close) => {
      // 将空段落统一为固定高度的空行，而不是删掉
      let cleaned = content
        .replace(/<p[^>]*>\s*(&nbsp;|\u00a0)?\s*<\/p>/gi, '<p style="margin:0;line-height:1.6">&nbsp;</p>')
        .replace(/<p[^>]*>\s*<br\s*\/?>\s*<\/p>/gi, '<p style="margin:0;line-height:1.6">&nbsp;</p>')
      return `${open}${cleaned}${close}`
    }
  )

  const ckeditorCss = await readCkeditorCss()
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${payload.title}</title>
  <style>
    ${ckeditorCss}
    @page { size: A4; margin: 18mm 22mm; }
    * { box-sizing: border-box; }
    html, body { width: 100%; margin: 0; padding: 0; }
    body {
      font-family: "SimSun", "宋体", "FangSong", "仿宋", "Microsoft YaHei", sans-serif;
      font-size: 12pt;
      line-height: 1.25;
      color: #000;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .ck-content {
      margin: 0 !important;
      padding: 0 !important;
      min-height: unset !important;
      max-height: unset !important;
      height: auto !important;
      border: none !important;
      box-shadow: none !important;
      overflow: visible !important;
    }
    .ck, .ck-editor, .ck-editor__main, .ck-editor__editable {
      min-height: unset !important;
      max-height: unset !important;
      height: auto !important;
      border: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
    h1 { font-size: 16pt; font-weight: bold; text-align: center; margin: 0.2em 0 0.4em; line-height: 1.3; }
    h2 { font-size: 14pt; font-weight: bold; margin: 0.2em 0; line-height: 1.3; }
    h3 { font-size: 13pt; font-weight: bold; margin: 0.15em 0; line-height: 1.3; }
    h4 { font-size: 12pt; font-weight: bold; margin: 0.1em 0; line-height: 1.3; }
    p { margin: 0.1em 0; line-height: 1.25; }
    .ck-content .table { margin: 0.3em 0 !important; }
    .ck-content .table table,
    table { border-collapse: collapse !important; width: 100% !important; table-layout: auto !important; }
    .ck-content .table table td,
    .ck-content .table table th,
    .ck-content table td,
    .ck-content table th,
    table td, table th {
      border: 1px solid #000 !important;
      padding: 2px 3px !important;
      font-size: 10.5pt !important;
      line-height: 1.15 !important;
      vertical-align: top !important;
      height: auto !important;
      min-height: 0 !important;
    }
    .ck-content .table table td p,
    .ck-content .table table th p,
    .ck-content table td p,
    .ck-content table th p,
    table td p, table th p {
      margin: 0 !important;
      padding: 0 !important;
      font-size: 10.5pt !important;
      line-height: 1.15 !important;
    }
    .ck-content .table table td br,
    .ck-content .table table th br,
    table td br, table th br {
      line-height: 0.5 !important;
      content: "" !important;
      display: block !important;
      margin-top: 2px !important;
    }
    /* 重置 CKEditor 可能给空段落的最小高度 */
    .ck-content p:empty,
    .ck-content p br:only-child {
      line-height: 0.8 !important;
      min-height: 0 !important;
      font-size: 10pt !important;
    }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    thead { display: table-header-group; }
    img { max-width: 100%; height: auto; }
    p, h1, h2, h3, h4, h5, h6 { orphans: 3; widows: 3; }
    h1, h2, h3, h4 { page-break-after: avoid; }
    ${extracted.styles}
  </style>
</head>
<body><div class="ck-content">${bodyHtml}</div></body>
</html>`
}

const buildImagePdfHtml = (images: string[]) => {
  const pages = images
    .map((img) => {
      const src = img.startsWith('data:') ? img : `data:image/png;base64,${img}`
      return `<div class="page"><img src="${src}" /></div>`
    })
    .join('\n')
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A4; margin: 0; }
    html, body { margin: 0; padding: 0; }
    .page { page-break-after: always; }
    img { width: 100%; height: auto; display: block; }
  </style>
</head>
<body>
${pages}
</body>
</html>`
}

export function registerExportIpc() {
  ipcMain.handle('doc:print', async (_event, payload: { title: string; content: string }) => {
    const html = await buildExportHtml(payload)
    const fs = await import('node:fs/promises')
    const tmpPath = path.join(app.getPath('temp'), `word-tool-print-${Date.now()}.html`)
    await fs.writeFile(tmpPath, html, 'utf8')
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true },
    })
    await printWin.loadFile(tmpPath)
    return new Promise((resolve) => {
      printWin.webContents.print({ printBackground: true }, async (success) => {
        printWin.destroy()
        try { await fs.unlink(tmpPath) } catch {}
        resolve(success)
      })
    })
  })

  ipcMain.handle('doc:export-pdf-images', async (_event, payload: { title: string; images: string[] }) => {
    if (!payload.images || payload.images.length === 0) return false
    const safeName = (value: string) => {
      const cleaned = value.replace(/[\\/:*?"<>|]+/g, '_').trim()
      return cleaned || '未命名'
    }
    const filename = safeName(payload.title)
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 PDF',
      defaultPath: `${filename}.pdf`,
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return false
    const finalPath = await ensureUniquePath(filePath)
    const html = buildImagePdfHtml(payload.images)
    const fs = await import('node:fs/promises')
    const tmpPath = path.join(app.getPath('temp'), `word-tool-export-images-${Date.now()}.html`)
    await fs.writeFile(tmpPath, html, 'utf8')
    const exportWin = new BrowserWindow({
      show: false,
      webPreferences: { sandbox: true },
    })
    await exportWin.loadFile(tmpPath)
    const data = await exportWin.webContents.printToPDF({
      printBackground: true,
      pageSize: 'A4',
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
    })
    await fs.writeFile(finalPath, data)
    exportWin.destroy()
    try { await fs.unlink(tmpPath) } catch {}
    return true
  })

  ipcMain.handle('doc:export', async (_event, payload: { title: string; content: string; format: 'pdf' | 'word' | 'html' }) => {
    const safeName = (value: string) => {
      const cleaned = value.replace(/[\\/:*?"<>|]+/g, '_').trim()
      return cleaned || '未命名'
    }
    const filename = safeName(payload.title)
    const html = await buildExportHtml(payload)

    if (payload.format === 'html') {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '导出 HTML',
        defaultPath: `${filename}.html`,
        filters: [{ name: 'HTML 文件', extensions: ['html'] }],
      })
      if (canceled || !filePath) return false
      const finalPath = await ensureUniquePath(filePath)
      const fs = await import('node:fs/promises')
      await fs.writeFile(finalPath, html, 'utf8')
      return true
    }

    if (payload.format === 'pdf') {
      const { canceled, filePath } = await dialog.showSaveDialog({
        title: '导出 PDF',
        defaultPath: `${filename}.pdf`,
        filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
      })
      if (canceled || !filePath) return false
      const finalPath = await ensureUniquePath(filePath)
      const fs = await import('node:fs/promises')
      const tmpPath = path.join(app.getPath('temp'), `word-tool-export-${Date.now()}.html`)
      await fs.writeFile(tmpPath, html, 'utf8')
      const exportWin = new BrowserWindow({
        show: false,
        webPreferences: { sandbox: true },
      })
      await exportWin.loadFile(tmpPath)
      const data = await exportWin.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: '<div style="width:100%;text-align:center;font-size:9px;color:#999;padding:0 20mm;">第 <span class="pageNumber"></span> 页 / 共 <span class="totalPages"></span> 页</div>',
        margins: { top: 0.4, bottom: 0.6, left: 0, right: 0 },
      })
      await fs.writeFile(finalPath, data)
      exportWin.destroy()
      try { await fs.unlink(tmpPath) } catch {}
      return true
    }

    // word
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 Word',
      defaultPath: `${filename}.docx`,
      filters: [{ name: 'Word 文件', extensions: ['docx'] }],
    })
    if (canceled || !filePath) return false
    const finalPath = await ensureUniquePath(filePath)
    const htmlToDocx = (await import('html-to-docx')).default
    const docxResult = await htmlToDocx(html)
    const fs = await import('node:fs/promises')
    const docxBuffer: Buffer = Buffer.isBuffer(docxResult)
      ? docxResult
      : docxResult instanceof ArrayBuffer
        ? Buffer.from(new Uint8Array(docxResult))
        : typeof Blob !== 'undefined' && docxResult instanceof Blob
          ? Buffer.from(new Uint8Array(await docxResult.arrayBuffer()))
          : Buffer.from(docxResult as any)
    await fs.writeFile(finalPath, docxBuffer)
    return true
  })
}
