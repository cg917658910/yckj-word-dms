/// <reference types="vite/client" />

type FolderRow = {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}

type DocSummary = {
  id: number
  folderId: number | null
  title: string
  snippet: string
  updatedAt: string
  size: number
}

type DocDetail = {
  id: number
  folderId: number | null
  title: string
  content: string
  updatedAt: string
  createdAt: string
}

type TemplateRow = {
  id: number
  name: string
  content: string
  updatedAt: string
  lastUsedAt?: string | null
  usageCount?: number | null
  folderId?: number | null
}

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer
  api: {
    print: () => Promise<boolean>
    exportDoc: (payload: { title: string; content: string; format: 'pdf' | 'word' }) => Promise<boolean>
    importTemplates: () => Promise<boolean>
    uploadTemplateFiles: (folderId?: number | null) => Promise<boolean>
    uploadTemplateFolder: (folderId?: number | null) => Promise<boolean>
    db: {
      init: () => Promise<boolean>
      listFolders: () => Promise<FolderRow[]>
      listTemplateFolders: () => Promise<FolderRow[]>
      listDocs: (folderId: number | null) => Promise<DocSummary[]>
      getDoc: (id: number) => Promise<DocDetail | null>
      saveDoc: (input: { id: number; title: string; content: string }) => Promise<DocDetail | null>
      createFolder: (input: { name: string; parentId: number | null }) => Promise<number>
      createTemplateFolder: (input: { name: string; parentId: number | null }) => Promise<number>
      renameTemplateFolder: (input: { id: number; name: string }) => Promise<boolean>
      deleteTemplateFolder: (id: number) => Promise<boolean>
      renameFolder: (input: { id: number; name: string }) => Promise<boolean>
      deleteFolder: (id: number) => Promise<boolean>
      createDoc: (input: { folderId: number | null; title: string; content?: string }) => Promise<DocDetail | null>
      renameDoc: (input: { id: number; title: string }) => Promise<DocDetail | null>
      deleteDoc: (id: number) => Promise<boolean>
      findReplace: (input: { query: string; replace: string; folderId: number | null }) => Promise<number>
      listTemplates: () => Promise<TemplateRow[]>
      createTemplate: (input: { name: string; content: string; folderId?: number | null }) => Promise<number>
      updateTemplate: (input: { id: number; name: string; content: string; folderId?: number | null }) => Promise<boolean>
      deleteTemplate: (id: number) => Promise<boolean>
      useTemplate: (id: number) => Promise<boolean>
      applyTemplate: (payload: { templateId: number; docId: number }) => Promise<DocDetail | null>
    }
  }
}
