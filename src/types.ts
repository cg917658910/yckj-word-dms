export type FolderNode = {
  id: number
  name: string
  parentId: number | null
  children: FolderNode[]
  docs: DocSummary[]
}

export type FolderRow = {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}

export type TemplateFolderRow = FolderRow

export type DocSummary = {
  id: number
  folderId: number | null
  title: string
  snippet: string
  updatedAt: string
  size: number
}

export type DocDetail = {
  id: number
  folderId: number | null
  title: string
  content: string
  updatedAt: string
  createdAt: string
}

export type TemplateRow = {
  id: number
  name: string
  content: string
  updatedAt: string
  lastUsedAt?: string | null
  usageCount?: number | null
  folderId?: number | null
}

export type DialogState = {
  title: string
  message?: string
  inputLabel?: string
  inputValue?: string
  confirmText?: string
  cancelText?: string
  showInput?: boolean
  onConfirm: (value?: string) => Promise<void> | void
}

export type MenuState = {
  folderId: number
  x: number
  y: number
  mode?: 'submenu'
}

export type TemplatePanelState = {
  folderId: number | null
  mode: 'create' | 'manage'
}

export type TemplateEditorState = {
  id?: number
  name: string
  content: string
  mode: 'create' | 'edit'
}

export type DocMenuState = {
  docId: number
  x: number
  y: number
}
