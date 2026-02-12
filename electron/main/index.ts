import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { registerDbIpc } from './db'
import { toHtmlFromFile } from './import'
import { registerOnlyOfficeIpc } from './onlyoffice'
import { registerUploadIpc } from './upload'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '../..')

export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL
process.env.NODE_ENV = process.env.NODE_ENV || (VITE_DEV_SERVER_URL ? 'development' : 'production')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, 'public')
  : RENDERER_DIST

if (os.release().startsWith('6.1')) app.disableHardwareAcceleration()
if (process.platform === 'win32') app.setAppUserModelId(app.getName())

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// 修改此日期控制试用期 本地时间为准
const end = new Date(2026, 1, 14, 0, 0, 0)
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
    width: 1600,
    height: 1000,
    minWidth: 1400,
    minHeight: 900,
    autoHideMenuBar: true,
    webPreferences: { preload },
  })
  win.setMenu(null)
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(indexHtml)
  }

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', new Date().toLocaleString())
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:')) shell.openExternal(url)
    return { action: 'deny' }
  })
}

app.whenReady().then(() => {
  registerDbIpc()
  registerOnlyOfficeIpc()
  registerUploadIpc()
  createWindow()
})

app.on('window-all-closed', () => {
  win = null
  if (process.platform !== 'darwin') app.quit()
})

app.on('second-instance', () => {
  if (win) {
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

ipcMain.handle('doc:open', async (_event, payload: { filePath: string }) => {
  if (!payload?.filePath) return false
  const result = await shell.openPath(payload.filePath)
  return result === ''
})

ipcMain.handle('doc:reveal', async (_event, payload: { filePath: string }) => {
  if (!payload?.filePath) return false
  shell.showItemInFolder(payload.filePath)
  return true
})

ipcMain.handle('file:preview', async (_event, payload: { filePath: string }) => {
  if (!payload?.filePath) return ''
  try {
    return await toHtmlFromFile(payload.filePath)
  } catch {
    return ''
  }
})

