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
  filePath: string | null
}

type DocDetail = {
  id: number
  folderId: number | null
  title: string
  updatedAt: string
  createdAt: string
  filePath: string | null
  size: number
}

type TemplateRow = {
  id: number
  name: string
  content: string
  updatedAt: string
  filePath?: string | null
  size?: number
  lastUsedAt?: string | null
  usageCount?: number | null
  folderId?: number | null
}

interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import('electron').IpcRenderer
  DocsAPI?: {
    DocEditor: new (elementId: string, config: unknown) => {
      destroyEditor?: () => void
    }
  }
  api: {
    print: (payload: { title: string; content: string }) => Promise<boolean>
    exportDoc: (payload: { title: string; content: string; format: 'pdf' | 'word' | 'html' }) => Promise<boolean>
    openDoc: (payload: { filePath: string }) => Promise<boolean>
    revealDoc: (payload: { filePath: string }) => Promise<boolean>
    previewFile: (payload: { filePath: string }) => Promise<string>
    importTemplates: () => Promise<boolean>
    onlyofficeGetConfig: (payload: { type: 'doc' | 'template'; id: number; title: string }) => Promise<{
      scriptUrl: string
      document: {
        title: string
        url: string
        fileType: string
        key: string
      }
      editorConfig: {
        callbackUrl: string
        mode: 'edit'
        lang: 'zh-CN'
        user: { id: string; name: string }
      }
    } | null>
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
      moveDoc: (input: { id: number; folderId: number | null }) => Promise<DocDetail | null>
      copyDoc: (input: { id: number; title: string }) => Promise<DocDetail | null>
      deleteDoc: (id: number) => Promise<boolean>
      findReplace: (input: { query: string; replace: string; folderId: number | null }) => Promise<number>
      listTemplates: () => Promise<TemplateRow[]>
      createTemplate: (input: { name: string; content: string; folderId?: number | null }) => Promise<number>
      updateTemplate: (input: { id: number; name: string; content: string; folderId?: number | null }) => Promise<boolean>
      renameTemplate: (input: { id: number; name: string }) => Promise<boolean>
      copyTemplate: (input: { id: number; name: string }) => Promise<number | null>
      createTemplateFromFile: (input: { name: string; sourcePath: string; folderId?: number | null }) => Promise<number | null>
      moveTemplate: (input: { id: number; folderId: number | null }) => Promise<boolean>
      deleteTemplate: (id: number) => Promise<boolean>
      useTemplate: (id: number) => Promise<boolean>
      createDocFromTemplate: (input: { templateId: number; folderId: number | null; title: string }) => Promise<DocDetail | null>
      applyTemplate: (payload: { templateId: number; docId: number }) => Promise<DocDetail | null>
    }
  }
}
