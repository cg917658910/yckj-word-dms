import { dialog, ipcMain } from 'electron'
import { createTemplateFolder, createTemplateFromFile, listTemplateFolders } from './db'

export function registerUploadIpc() {
  ipcMain.handle('template:upload-files', async (_event, payload?: { folderId?: number | null }) => {
    const allowedExtensions = ['pdf', 'docx', 'doc', 'html', 'htm']
    const { canceled, filePaths } = await dialog.showOpenDialog({
      title: '上传模板文件',
      filters: [{ name: '模板文件', extensions: allowedExtensions }],
      properties: ['openFile', 'multiSelections'],
    })
    if (canceled || !filePaths.length) return false
    const pathMod = await import('node:path')
    const allowedExtensionsStr = allowedExtensions.map((ext) => `.${ext}`).join(', ')
    try {
      for (const filePath of filePaths) {
        const ext = pathMod.extname(filePath).toLowerCase()
        if (!allowedExtensionsStr.includes(ext)) continue
        const base = pathMod.basename(filePath, ext)
        await createTemplateFromFile({ name: base, sourcePath: filePath, folderId: payload?.folderId ?? null })
      }
    } catch (error) {
      dialog.showErrorBox('上传失败', '请确保文件格式正确且内容不损坏。')
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
            await createTemplateFromFile({ name: base, sourcePath: abs, folderId: parentId })
          } catch (error) {
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
}
