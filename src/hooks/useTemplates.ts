import { useEffect, useMemo, useRef, useState } from 'react'
import type {
  DialogState,
  DocDetail,
  DocMenuState,
  TemplateEditorState,
  TemplateFolderRow,
  TemplatePanelState,
  TemplateRow,
} from '../types'
import { buildTree, collectDescendantIds, collectDescendantsOnly, toTemplateSummary } from '../utils/tree'

type Options = {
  openDialog: (state: DialogState) => void
}

export const useTemplates = ({ openDialog }: Options) => {
  const refreshTokenRef = useRef(0)
  const folderMutationRef = useRef(false)
  const [templateFolderRows, setTemplateFolderRows] = useState<TemplateFolderRow[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [activeTemplateFolderId, setActiveTemplateFolderId] = useState<number | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<TemplateRow | null>(null)
  const [collapsedTemplateFolders, setCollapsedTemplateFolders] = useState<Set<number>>(new Set())
  const [templatePanel, setTemplatePanel] = useState<TemplatePanelState | null>(null)
  const [templateEditor, setTemplateEditor] = useState<TemplateEditorState | null>(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [templatePickId, setTemplatePickId] = useState<number | null>(null)
  const [templateMenu, setTemplateMenu] = useState<DocMenuState | null>(null)
  const templateFolderMap = useMemo(
    () => new Map(templateFolderRows.map((row) => [row.id, row])),
    [templateFolderRows],
  )

  const syncTreeWithTemplates = (nextTemplates: TemplateRow[]) => {
    if (folderMutationRef.current) return
    setTemplates(nextTemplates)
  }

  const refreshTemplateFolders = async (
    templateList?: TemplateRow[],
    preserveCollapsed = true,
    force = false,
    pendingRow?: TemplateFolderRow,
  ) => {
    if (folderMutationRef.current && !force) return
    const token = ++refreshTokenRef.current
    const rows = await window.api.db.listTemplateFolders()
    const list = templateList ?? (await window.api.db.listTemplates())
    if (token !== refreshTokenRef.current) return
    const mergedRows = pendingRow
      ? [...rows.filter((row) => row.id !== pendingRow.id), pendingRow]
      : rows
    setTemplateFolderRows(mergedRows)
    setTemplates(list)
    if (!preserveCollapsed) {
      const collapsed = new Set<number>()
      const folderWithTemplates = new Set<number>()
      list.forEach((item) => {
        if (item.folderId !== null && item.folderId !== undefined) folderWithTemplates.add(item.folderId)
      })
      rows.forEach((row) => {
        const hasChildFolder = rows.some((child) => child.parentId === row.id)
        const hasTemplates = folderWithTemplates.has(row.id)
        if (hasChildFolder || hasTemplates) {
          collapsed.add(row.id)
        }
      })
      setCollapsedTemplateFolders(collapsed)
    } else {
      setCollapsedTemplateFolders((prev) => {
        const next = new Set(prev)
        next.forEach((id) => {
          if (!rows.some((row) => row.id === id)) next.delete(id)
        })
        return next
      })
    }
  }

  const handleSelectTemplateFolder = (folderId: number | null) => {
    setActiveTemplateFolderId(folderId)
    const next = folderId === null
      ? templates
      : templates.filter((tpl) => (tpl.folderId ?? null) === folderId)
    if (next.length) {
      setActiveTemplate(next[0])
    } else {
      setActiveTemplate(null)
    }
  }

  const handleSelectTemplate = (templateId: number) => {
    const item = templates.find((tpl) => tpl.id === templateId) ?? null
    setActiveTemplate(item)
  }

  const handleToggleTemplateFolder = (id: number) => {
    setCollapsedTemplateFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        const descendants = collectDescendantsOnly(templateFolderRows, id)
        descendants.forEach((childId) => next.add(childId))
      }
      return next
    })
  }

  const handleCreateTemplateFolder = async () => {
    openDialog({
      title: '新建模板文件夹',
      inputLabel: '文件夹名称',
      inputValue: '新建文件夹',
      confirmText: '创建',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        const id = await window.api.db.createTemplateFolder({ name: value, parentId: activeTemplateFolderId })
        if (!id) {
          return
        }
        const pendingRow: TemplateFolderRow = {
          id,
          name: value,
          parentId: activeTemplateFolderId,
          sortOrder: Date.now(),
        }
        setTemplateFolderRows((prev) => [...prev, pendingRow])
      },
    })
  }

  const handleRenameTemplateFolder = async () => {
    if (!activeTemplateFolderId) return
    const current = templateFolderMap.get(activeTemplateFolderId)
    openDialog({
      title: '重命名模板文件夹',
      inputLabel: '文件夹名称',
      inputValue: current?.name ?? '',
      confirmText: '保存',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        await window.api.db.renameTemplateFolder({ id: activeTemplateFolderId, name: value })
        const pendingRow: TemplateFolderRow = {
          id: activeTemplateFolderId,
          name: value,
          parentId: current?.parentId ?? null,
          sortOrder: current?.sortOrder ?? Date.now(),
        }
        setTemplateFolderRows((prev) =>
          prev.map((row) => (row.id === pendingRow.id ? { ...row, name: pendingRow.name } : row)),
        )
      },
    })
  }

  const handleDeleteTemplateFolder = async () => {
    if (!activeTemplateFolderId) return
    const current = templateFolderMap.get(activeTemplateFolderId)
    openDialog({
      title: '删除模板文件夹',
      message: `确定删除模板文件夹「${current?.name ?? ''}」及其子内容吗？`,
      confirmText: '删除',
      showInput: false,
      onConfirm: async () => {
        await window.api.db.deleteTemplateFolder(activeTemplateFolderId)
        const idsToRemove = collectDescendantIds(templateFolderRows, activeTemplateFolderId)
        setTemplateFolderRows((prev) => prev.filter((row) => !idsToRemove.has(row.id)))
        setTemplates((prev) =>
          prev.map((tpl) => (idsToRemove.has(tpl.folderId ?? -1) ? { ...tpl, folderId: null } : tpl)),
        )
        if (idsToRemove.has(activeTemplateFolderId)) setActiveTemplateFolderId(null)
      },
    })
  }

  const handleCreateTemplate = async (folderId: number | null) => {
    openDialog({
      title: '新建模板',
      inputLabel: '模板名称',
      inputValue: '未命名模板',
      confirmText: '创建',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        const id = await window.api.db.createTemplate({ name: value, content: '', folderId })
        if (!id) return
        const next = [
          { id, name: value, content: '', updatedAt: new Date().toISOString(), folderId },
          ...templates,
        ]
        syncTreeWithTemplates(next)
        setActiveTemplate(next[0])
      },
    })
  }

  const handleEditTemplate = async (template: TemplateRow) => {
    setTemplateEditor({
      mode: 'edit',
      id: template.id,
      name: template.name,
      content: template.content,
    })
  }

  const handleOpenTemplateEditor = (mode: 'create' | 'edit', template?: TemplateRow) => {
    setTemplateEditor({
      mode,
      id: template?.id,
      name: template?.name ?? '新模板',
      content: template?.content ?? '',
    })
  }

  const handleTemplateEditorSave = async () => {
    if (!templateEditor) return
    if (!templateEditor.name.trim()) return
    const content = templateEditor.content || ''
    if (templateEditor.mode === 'create') {
      await window.api.db.createTemplate({
        name: templateEditor.name.trim(),
        content,
        folderId: templatePanel?.folderId ?? activeTemplateFolderId,
      })
    } else if (templateEditor.id) {
      await window.api.db.updateTemplate({
        id: templateEditor.id,
        name: templateEditor.name.trim(),
        content,
        folderId: activeTemplateFolderId ?? null,
      })
    }
    const nextTemplates = await window.api.db.listTemplates()
    syncTreeWithTemplates(nextTemplates)
    setTemplateEditor(null)
  }

  const handleRenameTemplate = async () => {
    if (!activeTemplate) return
    openDialog({
      title: '重命名模板',
      inputLabel: '模板名称',
      inputValue: activeTemplate.name,
      confirmText: '保存',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        await window.api.db.updateTemplate({
          id: activeTemplate.id,
          name: value,
          content: activeTemplate.content,
          folderId: activeTemplate.folderId ?? null,
        })
        const next = { ...activeTemplate, name: value }
        setActiveTemplate(next)
        const nextTemplates = templates.map((tpl) => (tpl.id === next.id ? { ...tpl, name: next.name } : tpl))
        syncTreeWithTemplates(nextTemplates)
      },
    })
  }

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return
    openDialog({
      title: '删除模板',
      message: `确定删除模板「${activeTemplate.name}」吗？`,
      confirmText: '删除',
      showInput: false,
      onConfirm: async () => {
        await window.api.db.deleteTemplate(activeTemplate.id)
        const nextTemplates = templates.filter((tpl) => tpl.id !== activeTemplate.id)
        syncTreeWithTemplates(nextTemplates)
        const nextInFolder = nextTemplates.find((tpl) =>
          activeTemplateFolderId === null ? true : (tpl.folderId ?? null) === activeTemplateFolderId
        )
        setActiveTemplate(nextInFolder ?? null)
      },
    })
  }

  const handleCopyTemplate = async () => {
    if (!activeTemplate) return
    const id = await window.api.db.createTemplate({
      name: `${activeTemplate.name}-副本`,
      content: activeTemplate.content,
      folderId: activeTemplate.folderId ?? null,
    })
    if (!id) return
    const next = [
      {
        ...activeTemplate,
        id,
        name: `${activeTemplate.name}-副本`,
        updatedAt: new Date().toISOString(),
      },
      ...templates,
    ]
    syncTreeWithTemplates(next)
    setActiveTemplate(next[0])
  }

  const handleMoveTemplate = async (templateId: number, folderId: number | null) => {
    await window.api.db.moveTemplate({ id: templateId, folderId })
    setTemplates((prev) =>
      prev.map((tpl) => (tpl.id === templateId ? { ...tpl, folderId, updatedAt: new Date().toISOString() } : tpl)),
    )
    if (activeTemplate?.id === templateId) {
      setActiveTemplate({ ...activeTemplate, folderId })
    }
  }
  const handleUploadTemplateFiles = async (folderId: number | null) => {
    try {
      const ok = await window.api.uploadTemplateFiles(folderId)
      if (!ok) return
      const next = await window.api.db.listTemplates()
      await refreshTemplateFolders(next, true)
      if (typeof folderId === 'number') {
        setActiveTemplateFolderId(folderId)
        setCollapsedTemplateFolders((prev) => {
          const nextSet = new Set(prev)
          nextSet.delete(folderId)
          return nextSet
        })
        const inFolder = next.filter((tpl) => (tpl.folderId ?? null) === folderId)
        setActiveTemplate(inFolder[0] ?? null)
      } else {
        setActiveTemplateFolderId(null)
        const inRoot = next.filter((tpl) => (tpl.folderId ?? null) === null)
        setActiveTemplate(inRoot[0] ?? null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      openDialog({
        title: '上传模板失败',
        message,
        confirmText: '知道了',
        showInput: false,
        onConfirm: async () => {},
      })
    }
  }

  const handleUploadTemplateFolder = async (folderId: number | null) => {
    try {
      const ok = await window.api.uploadTemplateFolder(folderId)
      if (!ok) return
      const next = await window.api.db.listTemplates()
      await refreshTemplateFolders(next, true)
      if (typeof folderId === 'number') {
        setActiveTemplateFolderId(folderId)
        setCollapsedTemplateFolders((prev) => {
          const nextSet = new Set(prev)
          nextSet.delete(folderId)
          return nextSet
        })
        const inFolder = next.filter((tpl) => (tpl.folderId ?? null) === folderId)
        setActiveTemplate(inFolder[0] ?? null)
      } else {
        setActiveTemplateFolderId(null)
        const inRoot = next.filter((tpl) => (tpl.folderId ?? null) === null)
        setActiveTemplate(inRoot[0] ?? null)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      openDialog({
        title: '上传模板失败',
        message,
        confirmText: '知道了',
        showInput: false,
        onConfirm: async () => {},
      })
    }
  }

  const handleMenuCreateFromTemplate = async (folderId: number | null, template: TemplateRow): Promise<DocDetail | null> => {
    const detail = await window.api.db.createDoc({
      folderId,
      title: `${template.name}-${new Date().toLocaleDateString()}`,
      content: template.content,
    })
    return detail ?? null
  }

  const rootTemplates = useMemo(
    () => templates.filter((tpl) => (tpl.folderId ?? null) === null).map(toTemplateSummary),
    [templates],
  )
  const templateFolders = useMemo(
    () => buildTree(templateFolderRows, templates.map(toTemplateSummary)),
    [templateFolderRows, templates],
  )

  const filteredTemplates = useMemo(() => {
    const key = templateSearch.trim()
    if (!key) return templates
    return templates.filter((item) => item.name.includes(key))
  }, [templateSearch, templates])

  const handleTemplateMenuRename = async (templateId: number) => {
    setTemplateMenu(null)
    handleSelectTemplate(templateId)
    await handleRenameTemplate()
  }

  const handleTemplateMenuCopy = async (templateId: number) => {
    setTemplateMenu(null)
    handleSelectTemplate(templateId)
    await handleCopyTemplate()
  }

  const handleTemplateMenuDelete = async (templateId: number) => {
    setTemplateMenu(null)
    handleSelectTemplate(templateId)
    await handleDeleteTemplate()
  }

  useEffect(() => {
    if (!activeTemplate && templates.length) {
      setActiveTemplate(templates[0])
    }
  }, [templates, activeTemplate])

  const recentTemplates = useMemo(() => templates.slice(0, 10), [templates])

  return {
    templateFolderRows,
    templateFolders,
    templates,
    activeTemplateFolderId,
    activeTemplate,
    collapsedTemplateFolders,
    templatePanel,
    templateEditor,
    templateSearch,
    templatePickId,
    templateMenu,
    recentTemplates,
    filteredTemplates,
    rootTemplates,
    setTemplatePanel,
    setTemplateEditor,
    setTemplateSearch,
    setTemplatePickId,
    setTemplateMenu,
    setActiveTemplateFolderId,
    setActiveTemplate,
    syncTreeWithTemplates,
    refreshTemplateFolders,
    handleSelectTemplateFolder,
    handleSelectTemplate,
    handleToggleTemplateFolder,
    handleCreateTemplateFolder,
    handleRenameTemplateFolder,
    handleDeleteTemplateFolder,
    handleCreateTemplate,
    handleEditTemplate,
    handleOpenTemplateEditor,
    handleTemplateEditorSave,
    handleRenameTemplate,
    handleDeleteTemplate,
    handleCopyTemplate,
    handleMoveTemplate,
    handleUploadTemplateFiles,
    handleUploadTemplateFolder,
    handleMenuCreateFromTemplate,
    handleTemplateMenuRename,
    handleTemplateMenuCopy,
    handleTemplateMenuDelete,
  }
}



