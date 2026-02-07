import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTemplate, createTemplateFolder, listTemplateFolders, registerDbIpc } from './db'
//import { update } from './update'

const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}
// 修改此日期控制试用期 本地时间为准
const end = new Date(2026, 1, 8, 0, 0, 0) // 月份从 0 开始：6 = 7月
if (new Date() > end) {
  dialog.showErrorBox('试用期已结束', '感谢您使用本软件，如需继续使用请联系开发者。')
  app.quit()
  process.exit(0)
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, '../preload/index.mjs')
const indexHtml = path.join(RENDERER_DIST, 'index.html')

async function createWindow() {
  win = new BrowserWindow({
    title: 'Main window',
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    // 默认宽高
    width: 1600,
    height: 1000,
    minWidth: 1400,
    minHeight: 900,

    // 隐藏菜单栏（Windows/Linux 生效）
    autoHideMenuBar: true,
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  })
  win.setMenu(null)
  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })

  // Auto update
  //update(win)
}

app.whenReady().then(() => {
  registerDbIpc()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.on('activate', () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    createWindow()
  }
})

// New window example arg: new windows url
ipcMain.handle('open-win', (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`)
  } else {
    childWindow.loadFile(indexHtml, { hash: arg })
  }
})

ipcMain.handle('doc:print', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return false
  return new Promise((resolve) => {
    win.webContents.print({ printBackground: true }, (success) => resolve(success))
  })
})

ipcMain.handle('doc:export', async (event, payload: { title: string; content: string; format: 'pdf' | 'word' }) => {
  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${payload.title}</title>
  <style>
    body { font-family: "Microsoft YaHei", "Noto Sans SC", sans-serif; line-height: 1.8; padding: 24px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #e2e8f0; padding: 8px; text-align: left; }
    img { max-width: 100%; }
  </style>
</head>
<body>${payload.content}</body>
</html>`

  if (payload.format === 'pdf') {
    const { canceled, filePath } = await dialog.showSaveDialog({
      title: '导出 PDF',
      defaultPath: `${payload.title}.pdf`,
      filters: [{ name: 'PDF 文件', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return false

    const exportWin = new BrowserWindow({
      show: false,
      webPreferences: {
        sandbox: true,
      },
    })
    await exportWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
    const data = await exportWin.webContents.printToPDF({ printBackground: true })
    const fs = await import('node:fs/promises')
    await fs.writeFile(filePath, data)
    exportWin.destroy()
    return true
  }

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: '导出 Word',
    defaultPath: `${payload.title}.docx`,
    filters: [{ name: 'Word 文件', extensions: ['docx'] }],
  })
  if (canceled || !filePath) return false
  const htmlToDocx = (await import('html-to-docx')).default
  const docxResult = await htmlToDocx(html)
  const fs = await import('node:fs/promises')

  // html-to-docx may return Buffer / ArrayBuffer / Blob depending on environment/types.
  const docxBuffer: Buffer = Buffer.isBuffer(docxResult)
    ? docxResult
    : docxResult instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(docxResult))
      : typeof Blob !== 'undefined' && docxResult instanceof Blob
        ? Buffer.from(new Uint8Array(await docxResult.arrayBuffer()))
        : Buffer.from(docxResult as any)

  await fs.writeFile(filePath, docxBuffer)
  return true
})

const toHtmlFromFile = async (filePath: string) => {
  const fs = await import('node:fs/promises')
  const pathMod = await import('node:path')
  const ext = pathMod.extname(filePath).toLowerCase()
  if (ext === '.html' || ext === '.htm') {
    return fs.readFile(filePath, 'utf8')
  }
  if (ext === '.docx') {
    const mammoth = await import('mammoth')
    const buffer = await fs.readFile(filePath)
    const styleMap = [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Quote'] => blockquote:fresh",
    ]
    const result = await mammoth.convertToHtml(
      { buffer },
      {
        includeDefaultStyleMap: true,
        styleMap,
        ignoreEmptyParagraphs: false,
        /* convertImage: mammoth.images.inline(async (image: any) => {
          const buffer = await image.read('base64')
          return { src: `data:${image.contentType};base64,${buffer}` }
        }), */
      },
    )
    const normalized = result.value
      .replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;')
      .replace(/ {2,}/g, (m: string) => `${'&nbsp;'.repeat(m.length - 1)} `)
    return `<div class="docx-import">${normalized}</div>`
  }
  if (ext === '.pdf') {
    const buffer = await fs.readFile(filePath)
    const pdfParse = require('pdf-parse/dist/node/cjs/index.cjs') as (input: Buffer) => Promise<{ text: string }>
    const data = await pdfParse(buffer)
    return `<p>${data.text.replace(/\n+/g, '<br/>')}</p>`
  }
  return ''
}

ipcMain.handle('template:upload-files', async (_event, payload?: { folderId?: number | null }) => {
  const allowedExtensions = ['pdf', 'docx', 'doc', 'html', 'htm']
  const allowedExtensionsStr = allowedExtensions.map((ext) => `.${ext}`).join(', ')
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '上传模板文件',
    filters: [{ name: '模板文件', extensions: allowedExtensions }],
    properties: ['openFile', 'multiSelections'],
  })
  if (canceled || !filePaths.length) return false
  const pathMod = await import('node:path')
  try {
  for (const filePath of filePaths) {
    const ext = pathMod.extname(filePath).toLowerCase()
    if (!allowedExtensionsStr.includes(ext)) continue
    const base = pathMod.basename(filePath, ext)
    const html = await toHtmlFromFile(filePath)
    if (!html) continue
    await createTemplate({ name: base, content: html, folderId: payload?.folderId ?? null })
  }
  } catch (error) {
    console.warn('上传模板失败:', error)
    dialog.showErrorBox('上传失败', `请确保文件格式正确且内容不损坏。`)
    return false
  }
  return true
})

ipcMain.handle('template:upload-folder', async (_event, payload?: { folderId?: number | null }) => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '上传模板文件夹',
    properties: ['openDirectory', 'multiSelections'],
  })
  if (canceled || !filePaths.length) return false
  const fs = await import('node:fs/promises')
  const pathMod = await import('node:path')
  const existing = await listTemplateFolders()
  const folderKey = (parentId: number | null, name: string) => `${parentId ?? 'root'}::${name}`
  const folderIdByKey = new Map(existing.map((f) => [folderKey(f.parentId, f.name), f.id]))

  const ensureFolder = async (name: string, parentId: number | null) => {
    const key = folderKey(parentId, name)
    const existingId = folderIdByKey.get(key)
    if (existingId) return existingId
    const id = await createTemplateFolder({ name, parentId })
    folderIdByKey.set(key, id)
    return id
  }

  const walk = async (root: string, current: string, parentId: number | null) => {
    const entries = await fs.readdir(current, { withFileTypes: true })
    for (const entry of entries) {
      const abs = pathMod.join(current, entry.name)
      if (entry.isDirectory()) {
        const nextId = await ensureFolder(entry.name, parentId)
        await walk(root, abs, nextId)
      } else {
        const ext = pathMod.extname(entry.name).toLowerCase()
          if (!['.pdf', '.docx', '.html', '.htm'].includes(ext)) continue
          const base = pathMod.basename(entry.name, ext)
          try {
            const html = await toHtmlFromFile(abs)
            if (!html) continue
            await createTemplate({ name: base, content: html, folderId: parentId })
          } catch (error) {
            console.warn('上传模板失败:', abs, error)
            throw error
          }
        }
      }
    }

  for (const root of filePaths) {
    const rootName = pathMod.basename(root)
    const rootId = await ensureFolder(rootName, payload?.folderId ?? null)
    await walk(root, root, rootId)
  }
  return true
})

