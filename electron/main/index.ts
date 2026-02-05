import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { importTemplates, registerDbIpc } from './db'
import { update } from './update'

const require = createRequire(import.meta.url)
const pdfParse = require("pdf-parse");
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
  update(win)
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

ipcMain.handle('template:import', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: '导入模板',
    filters: [
      { name: '模板文件', extensions: ['pdf', 'docx', 'doc'] },
    ],
    properties: ['openFile', 'multiSelections'],
  })
  if (canceled || !filePaths.length) return false
 
  const mammoth = await import('mammoth')
  const fs = await import('node:fs/promises')
  const pathMod = await import('node:path')

  const items: Array<{ name: string; content: string }> = []

  for (const filePath of filePaths) {
    const ext = pathMod.extname(filePath).toLowerCase()
    const base = pathMod.basename(filePath, ext)
    if (ext === '.docx') {
      const buffer = await fs.readFile(filePath) // Buffer
      const result = await mammoth.convertToHtml({ buffer })
      items.push({ name: base, content: result.value })
    } else if (ext === '.pdf') {
      const buffer = await fs.readFile(filePath)
      // 关键这一行 ↓↓↓
      const pdf =
  typeof pdfParse === "function"
    ? pdfParse
    : typeof pdfParse?.default === "function"
    ? pdfParse.default
    : typeof pdfParse?.default?.default === "function"
    ? pdfParse.default.default
    : null;

if (!pdf) {
  throw new Error("pdf-parse export shape not supported");
}
      const data = await pdf(buffer)
      const html = `<p>${data.text.replace(/\n+/g, '<br/>')}</p>`
      items.push({ name: base, content: html })
    } else if (ext === '.doc') {
      const buffer = await fs.readFile(filePath) // Buffer
      const html = `<p>已导入 Word 文档（.doc），请手动校对格式。</p><pre>${buffer.toString('base64').slice(0, 200)}...</pre>`
      items.push({ name: base, content: html })
    }
  }

  if (!items.length) return false
  await importTemplates(items)
  return true
})
