import { Fragment, createElement, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { DialogState, DocDetail, DocMenuState, DocSummary, FolderNode, FolderRow } from '../types'
import { buildTree, collectDescendantIds, collectDescendantsOnly, stripHtml, toDocSummary } from '../utils/tree'

type Options = {
  openDialog: (state: DialogState) => void
}

export const useDocuments = ({ openDialog }: Options) => {
  const [folderRows, setFolderRows] = useState<FolderRow[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [activeDoc, setActiveDoc] = useState<DocDetail | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set())
  const [docMenu, setDocMenu] = useState<DocMenuState | null>(null)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findCommitQuery, setFindCommitQuery] = useState('')

  const folderMap = useMemo(() => new Map(folderRows.map((row) => [row.id, row])), [folderRows])

  const syncTreeWithDocs = (nextDocs: DocSummary[], nextRows = folderRows) => {
    setDocs(nextDocs)
    setFolders(buildTree(nextRows, nextDocs))
  }

  const refreshFolders = async (docList?: DocSummary[], preserveCollapsed = true) => {
    const rows = await window.api.db.listFolders()
    const list = docList ?? (await window.api.db.listDocs(null))
    setFolderRows(rows)
    setFolders(buildTree(rows, list))
    const folderWithDocs = new Set<number>()
    list.forEach((doc) => {
      if (doc.folderId !== null) folderWithDocs.add(doc.folderId)
    })
    if (!preserveCollapsed) {
      const collapsed = new Set<number>()
      rows.forEach((row) => {
        const hasChildFolder = rows.some((child) => child.parentId === row.id)
        const hasDocs = folderWithDocs.has(row.id)
        if (hasChildFolder || hasDocs) {
          collapsed.add(row.id)
        }
      })
      setCollapsedFolders(collapsed)
    } else {
      setCollapsedFolders((prev) => {
        const next = new Set(prev)
        next.forEach((id) => {
          if (!rows.some((row) => row.id === id)) next.delete(id)
        })
        rows.forEach((row) => {
          const hasChildFolder = rows.some((child) => child.parentId === row.id)
          const hasDocs = folderWithDocs.has(row.id)
          if ((hasChildFolder || hasDocs) && !next.has(row.id)) {
            next.add(row.id)
          }
        })
        return next
      })
    }
  }

  const refreshDocs = async (folderId: number | null) => {
    const listAll = await window.api.db.listDocs(null)
    setDocs(listAll)
    await refreshFolders(listAll, true)
    const listInFolder = folderId === null ? listAll : listAll.filter((doc) => doc.folderId === folderId)
    const currentId = activeDoc?.id ?? null
    const current = currentId ? listAll.find((doc) => doc.id === currentId) : null
    const canKeepCurrent =
      current &&
      (folderId === null || current.folderId === folderId)
    if (canKeepCurrent) return
    if (listInFolder.length) {
      const detail = await window.api.db.getDoc(listInFolder[0].id)
      setActiveDoc(detail)
    } else {
      setActiveDoc(null)
    }
  }

  const handleSelectFolder = async (folderId: number | null) => {
    setActiveFolderId(folderId)
    const next = folderId === null ? docs : docs.filter((doc) => doc.folderId === folderId)
    if (next.length) {
      const detail = await window.api.db.getDoc(next[0].id)
      setActiveDoc(detail)
    } else {
      setActiveDoc(null)
    }
  }

  const handleSelectDoc = async (docId: number) => {
    const detail = await window.api.db.getDoc(docId)
    setActiveDoc(detail)
  }

  const handleToggleFolder = (id: number) => {
    setCollapsedFolders((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        const descendants = collectDescendantsOnly(folderRows, id)
        descendants.forEach((childId) => next.add(childId))
      }
      return next
    })
  }

  const handleCreateFolder = async () => {
    openDialog({
      title: '新建文件夹',
      inputLabel: '文件夹名称',
      inputValue: '',
      confirmText: '创建',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        const id = await window.api.db.createFolder({ name: value, parentId: activeFolderId })
        if (!id) return
        const newRow: FolderRow = {
          id,
          name: value,
          parentId: activeFolderId,
          sortOrder: Date.now(),
        }
        setFolderRows((prev) => {
          const next = [...prev, newRow]
          setFolders(buildTree(next, docs))
          return next
        })
      },
    })
  }

  const handleRenameFolder = async () => {
    if (!activeFolderId) return
    const current = folderMap.get(activeFolderId)
    openDialog({
      title: '重命名文件夹',
      inputLabel: '文件夹名称',
      inputValue: current?.name ?? '',
      confirmText: '保存',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        await window.api.db.renameFolder({ id: activeFolderId, name: value })
        setFolderRows((prev) => {
          const next = prev.map((row) => (row.id === activeFolderId ? { ...row, name: value } : row))
          setFolders(buildTree(next, docs))
          return next
        })
      },
    })
  }

  const handleDeleteFolder = async () => {
    if (!activeFolderId) return
    const current = folderMap.get(activeFolderId)
    openDialog({
      title: '删除文件夹',
      message: `确定删除文件夹「${current?.name ?? ''}」及其子内容吗？`,
      confirmText: '删除',
      showInput: false,
      onConfirm: async () => {
        await window.api.db.deleteFolder(activeFolderId)
        const idsToRemove = collectDescendantIds(folderRows, activeFolderId)
        setFolderRows((prev) => {
          const next = prev.filter((row) => !idsToRemove.has(row.id))
          const nextDocs = docs.filter((doc) => !idsToRemove.has(doc.folderId ?? -1))
          syncTreeWithDocs(nextDocs, next)
          return next
        })
        if (idsToRemove.has(activeFolderId)) setActiveFolderId(null)
        if (activeDoc && idsToRemove.has(activeDoc.folderId ?? -1)) setActiveDoc(null)
      },
    })
  }

  const handleMenuCreateDoc = async (folderId: number) => {
    openDialog({
      title: '新建文档',
      inputLabel: '文档标题',
      inputValue: '未命名文档',
      confirmText: '创建',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        const detail = await window.api.db.createDoc({ folderId, title: value, content: '' })
        if (!detail) return
        const nextDocs = [toDocSummary(detail), ...docs]
        syncTreeWithDocs(nextDocs)
        setActiveDoc(detail)
      },
    })
  }

  const handleCreateDoc = async () => {
    openDialog({
      title: '新建文档',
      inputLabel: '文档标题',
      inputValue: '未命名文档',
      confirmText: '创建',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        const detail = await window.api.db.createDoc({ folderId: activeFolderId, title: value, content: '' })
        if (!detail) return
        const nextDocs = [toDocSummary(detail), ...docs]
        syncTreeWithDocs(nextDocs)
        setActiveDoc(detail)
      },
    })
  }

  const handleRenameDoc = async () => {
    if (!activeDoc) return
    openDialog({
      title: '重命名文档',
      inputLabel: '文档标题',
      inputValue: activeDoc.title,
      confirmText: '保存',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        const detail = await window.api.db.renameDoc({ id: activeDoc.id, title: value })
        if (detail) setActiveDoc(detail)
        if (detail) {
          const nextDocs = docs.map((doc) => (doc.id === detail.id ? { ...doc, title: detail.title, updatedAt: detail.updatedAt } : doc))
          syncTreeWithDocs(nextDocs)
        }
      },
    })
  }

  const handleDeleteDoc = async () => {
    if (!activeDoc) return
    openDialog({
      title: '删除文档',
      message: `确定删除文档「${activeDoc.title}」吗？`,
      confirmText: '删除',
      showInput: false,
      onConfirm: async () => {
        await window.api.db.deleteDoc(activeDoc.id)
        const nextDocs = docs.filter((doc) => doc.id !== activeDoc.id)
        syncTreeWithDocs(nextDocs)
        const nextInFolder = nextDocs.find((doc) =>
          activeFolderId === null ? true : doc.folderId === activeFolderId
        )
        if (nextInFolder) {
          const detail = await window.api.db.getDoc(nextInFolder.id)
          setActiveDoc(detail)
        } else {
          setActiveDoc(null)
        }
      },
    })
  }

  const handleCopyDoc = async () => {
    if (!activeDoc) return
    const detail = await window.api.db.createDoc({
      folderId: activeDoc.folderId,
      title: `${activeDoc.title}-副本`,
      content: activeDoc.content,
    })
    if (!detail) return
    const nextDocs = [toDocSummary(detail), ...docs]
    syncTreeWithDocs(nextDocs)
    setActiveDoc(detail)
  }

  const rootDocs = useMemo(() => docs.filter((doc) => doc.folderId === null), [docs])

  const matchedDocs = useMemo(() => {
    const q = findCommitQuery.trim()
    if (!q) return []
    return docs.filter((doc) => doc.title.includes(q) || doc.snippet.includes(q))
  }, [docs, findCommitQuery])

  const highlight = (text: string, query: string): ReactNode => {
    if (!query) return text
    const parts = text.split(query)
    if (parts.length === 1) return text
    const nodes: ReactNode[] = []
    parts.forEach((part, idx) => {
      if (part) nodes.push(part)
      if (idx < parts.length - 1) {
        nodes.push(createElement('mark', { className: 'highlight', key: `m-${idx}` }, query))
      }
    })
    return createElement(Fragment, null, ...nodes)
  }

  const handleDocMenuRename = async (docId: number) => {
    setDocMenu(null)
    await handleSelectDoc(docId)
    await handleRenameDoc()
  }

  const handleDocMenuCopy = async (docId: number) => {
    setDocMenu(null)
    await handleSelectDoc(docId)
    await handleCopyDoc()
  }

  const handleDocMenuDelete = async (docId: number) => {
    setDocMenu(null)
    await handleSelectDoc(docId)
    await handleDeleteDoc()
  }

  return {
    folderRows,
    folders,
    docs,
    activeFolderId,
    activeDoc,
    collapsedFolders,
    docMenu,
    findQuery,
    replaceQuery,
    findCommitQuery,
    matchedDocs,
    rootDocs,
    setDocMenu,
    setFindQuery,
    setReplaceQuery,
    setFindCommitQuery,
    setActiveFolderId,
    setActiveDoc,
    syncTreeWithDocs,
    refreshFolders,
    refreshDocs,
    handleSelectFolder,
    handleSelectDoc,
    handleToggleFolder,
    handleCreateFolder,
    handleRenameFolder,
    handleDeleteFolder,
    handleMenuCreateDoc,
    handleCreateDoc,
    handleRenameDoc,
    handleDeleteDoc,
    handleCopyDoc,
    highlight,
    handleDocMenuRename,
    handleDocMenuCopy,
    handleDocMenuDelete,
  }
}
