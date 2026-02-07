import type { CSSProperties, MouseEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type FolderNode = {
  id: number
  name: string
  parentId: number | null
  children: FolderNode[]
  docs: DocSummary[]
}

type FolderRow = {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}

type TemplateFolderRow = FolderRow

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

type DialogState = {
  title: string
  message?: string
  inputLabel?: string
  inputValue?: string
  confirmText?: string
  cancelText?: string
  showInput?: boolean
  onConfirm: (value?: string) => Promise<void> | void
}

type MenuState = {
  folderId: number
  x: number
  y: number
  mode?: 'submenu'
}

type TemplatePanelState = {
  folderId: number | null
  mode: 'create' | 'manage'
}

type TemplateEditorState = {
  id?: number
  name: string
  content: string
  mode: 'create' | 'edit'
}

type DocMenuState = {
  docId: number
  x: number
  y: number
}

function buildTree(rows: FolderRow[], docs: DocSummary[]): FolderNode[] {
  const map = new Map<number, FolderNode>()
  const roots: FolderNode[] = []
  const docsByFolder = new Map<number | null, DocSummary[]>()

  docs.forEach((doc) => {
    const list = docsByFolder.get(doc.folderId ?? null) ?? []
    list.push(doc)
    docsByFolder.set(doc.folderId ?? null, list)
  })

  rows.forEach((row) => {
    map.set(row.id, { id: row.id, name: row.name, parentId: row.parentId, children: [], docs: [] })
  })

  rows.forEach((row) => {
    const node = map.get(row.id)
    if (!node) return
    if (row.parentId) {
      const parent = map.get(row.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  rows.forEach((row) => {
    const node = map.get(row.id)
    if (!node) return
    node.docs = docsByFolder.get(row.id) ?? []
  })

  const sortTree = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    nodes.forEach((child) => sortTree(child.children))
  }
  sortTree(roots)

  return roots
}

const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const toDocSummary = (detail: DocDetail): DocSummary => {
  const text = stripHtml(detail.content || '')
  return {
    id: detail.id,
    folderId: detail.folderId ?? null,
    title: detail.title,
    snippet: text.slice(0, 120),
    updatedAt: detail.updatedAt,
    size: (detail.content || '').length,
  }
}

const toTemplateSummary = (template: TemplateRow): DocSummary => {
  const text = stripHtml(template.content || '')
  return {
    id: template.id,
    folderId: template.folderId ?? null,
    title: template.name,
    snippet: text.slice(0, 120),
    updatedAt: template.updatedAt,
    size: (template.content || '').length,
  }
}

const collectDescendantIds = (rows: FolderRow[], rootId: number) => {
  const ids = new Set<number>([rootId])
  let changed = true
  while (changed) {
    changed = false
    rows.forEach((row) => {
      if (row.parentId !== null && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id)
        changed = true
      }
    })
  }
  return ids
}

const collectDescendantsOnly = (rows: FolderRow[], rootId: number) => {
  const ids = collectDescendantIds(rows, rootId)
  ids.delete(rootId)
  return ids
}

function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}

function formatSize(size: number) {
  if (size < 1024) return `${size} B`
  const kb = size / 1024
  if (kb < 1024) return `${kb.toFixed(1)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

function renderTree(
  nodes: FolderNode[],
  depth = 0,
  selectedId: number | null | undefined,
  onSelect: ((id: number | null) => void) | undefined,
  collapsed: Set<number>,
  onToggle: (id: number) => void,
  onMenu: (id: number, x: number, y: number) => void,
  hoverId: number | null,
  setHoverId: (id: number | null) => void,
  onSelectDoc: (id: number) => void,
  activeDocId: number | null,
  onDocMenu: (id: number, x: number, y: number) => void,
) {
  return nodes.map((node) => (
    (() => {
      const hasToggle = node.children.length || node.docs.length
      return (
    <div key={`${node.id}-${depth}`} className='tree-node' style={{ '--depth': depth } as CSSProperties}>
      <div
        className='tree-row-wrap'
        onMouseEnter={() => setHoverId(node.id)}
        onMouseLeave={() => setHoverId(null)}
        onContextMenu={(event) => {
          event.preventDefault()
          onMenu(node.id, event.clientX, event.clientY)
        }}
      >
        <button
          className={`tree-row ${selectedId === node.id ? 'active' : ''}`}
          onClick={() => {
            onSelect?.(node.id)
            if (hasToggle) onToggle(node.id)
          }}
        >
          <span
              className='tree-toggle'
              onClick={(event) => {
                event.stopPropagation()
                onToggle(node.id)
              }}
            >
              {collapsed.has(node.id) ? '+' : '-'}
            </span>
          <span className='tree-icon' />
          <span className='tree-name'>{node.name}</span>
        </button>
       {/*  <button
          className={`tree-more ${hoverId === node.id ? 'visible' : ''}`}
          onClick={(event) => {
            event.stopPropagation()
            const rect = (event.currentTarget as HTMLButtonElement).getBoundingClientRect()
            onMenu(node.id, rect.left, rect.bottom + 6)
          }}
        >
          •••
        </button> */}
      </div>
      {node.children.length && !collapsed.has(node.id) ? (
        <div className='tree-children'>
          {renderTree(
            node.children,
            depth + 1,
            selectedId,
            onSelect,
            collapsed,
            onToggle,
            onMenu,
            hoverId,
            setHoverId,
            onSelectDoc,
            activeDocId,
            onDocMenu,
          )}
        </div>
      ) : null}
      {!collapsed.has(node.id) && node.docs.length ? (
        <div className='tree-docs'>
          {node.docs.map((doc) => (
            <button
              key={doc.id}
              className={`tree-doc ${activeDocId === doc.id ? 'active' : ''}`}
              onClick={() => onSelectDoc(doc.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                onDocMenu(doc.id, event.clientX, event.clientY)
              }}
            >
              <span className='doc-icon small' />
              <span className='tree-doc-title'>{doc.title}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
      )
    })()
  ))
}

function App() {
  const [folderRows, setFolderRows] = useState<FolderRow[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [templateFolderRows, setTemplateFolderRows] = useState<TemplateFolderRow[]>([])
  const [templateFolders, setTemplateFolders] = useState<FolderNode[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [activeTemplateFolderId, setActiveTemplateFolderId] = useState<number | null>(null)
  const [activeDoc, setActiveDoc] = useState<DocDetail | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<TemplateRow | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const suppressSelectionRef = useRef(false)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dialogValue, setDialogValue] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set())
  const [collapsedTemplateFolders, setCollapsedTemplateFolders] = useState<Set<number>>(new Set())
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [hoverFolderId, setHoverFolderId] = useState<number | null>(null)
  const [templatePanel, setTemplatePanel] = useState<TemplatePanelState | null>(null)
  const [templateEditor, setTemplateEditor] = useState<TemplateEditorState | null>(null)
  const [menuSubOpen, setMenuSubOpen] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const templateEditorRef = useRef<HTMLDivElement | null>(null)
  const [docMenu, setDocMenu] = useState<DocMenuState | null>(null)
  const [templateMenu, setTemplateMenu] = useState<DocMenuState | null>(null)
  const [hoverDocId, setHoverDocId] = useState<number | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [editorMenuOpen, setEditorMenuOpen] = useState(false)
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [lineHeight, setLineHeight] = useState('1.9')
  const [viewMode, setViewMode] = useState<'doc' | 'template'>('doc')
  const [templatePickId, setTemplatePickId] = useState<number | null>(null)

  const syncTreeWithDocs = (nextDocs: DocSummary[], nextRows = folderRows) => {
    setDocs(nextDocs)
    setFolders(buildTree(nextRows, nextDocs))
  }

  const syncTreeWithTemplates = (nextTemplates: TemplateRow[], nextRows = templateFolderRows) => {
    setTemplates(nextTemplates)
    const templateDocs = nextTemplates.map(toTemplateSummary)
    setTemplateFolders(buildTree(nextRows, templateDocs))
  }
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findCommitQuery, setFindCommitQuery] = useState('')

  const folderMap = useMemo(() => new Map(folderRows.map((row) => [row.id, row])), [folderRows])
  const templateFolderMap = useMemo(
    () => new Map(templateFolderRows.map((row) => [row.id, row])),
    [templateFolderRows]
  )

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
        // drop removed folders
        next.forEach((id) => {
          if (!rows.some((row) => row.id === id)) next.delete(id)
        })
        // add new folders with children/docs as collapsed by default
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

  const refreshTemplateFolders = async (templateList?: TemplateRow[], preserveCollapsed = true) => {
    const rows = await window.api.db.listTemplateFolders()
    const list = templateList ?? (await window.api.db.listTemplates())
    setTemplateFolderRows(rows)
    setTemplates(list)
    setTemplateFolders(buildTree(rows, list.map(toTemplateSummary)))
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

  const openDialog = (state: DialogState) => {
    setDialog(state)
    setDialogValue(state.inputValue ?? '')
  }

  const closeDialog = () => {
    setDialog(null)
  }

  const handleDialogConfirm = async () => {
    if (!dialog) return
    await dialog.onConfirm(dialog.showInput ? dialogValue.trim() : undefined)
    closeDialog()
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

  useEffect(() => {
    const boot = async () => {
      await window.api.db.init()
      const [templateRows] = await Promise.all([
        window.api.db.listTemplates(),
        refreshFolders(undefined, false),
        refreshTemplateFolders(undefined, false),
      ])
      setTemplates(templateRows)
      await refreshDocs(null)
    }
    boot()
  }, [])

  useEffect(() => {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('defaultParagraphSeparator', false, 'p')
  }, [])

  useEffect(() => {
    const handleSelectionChange = () => {
      if (suppressSelectionRef.current) return
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      const container = editorRef.current
      if (!container) return
      if (container.contains(range.startContainer) && container.contains(range.endContainer)) {
        savedRangeRef.current = range.cloneRange()
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  const captureSelection = () => {
    const selection = window.getSelection()
    const container = editorRef.current
    if (!selection || selection.rangeCount === 0 || !container) return
    const range = selection.getRangeAt(0)
    if (container.contains(range.startContainer) && container.contains(range.endContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }

  const restoreSelection = () => {
    const range = savedRangeRef.current
    const selection = window.getSelection()
    if (!range || !selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  useEffect(() => {
    if (viewMode !== 'doc') return
    if (!activeDoc || !editorRef.current) return
    editorRef.current.innerHTML = activeDoc.content || ''
    setTitleDraft(activeDoc.title)
  }, [activeDoc, viewMode])

  useEffect(() => {
    if (viewMode !== 'template') return
    if (!activeTemplate || !editorRef.current) return
    editorRef.current.innerHTML = activeTemplate.content || ''
    setTitleDraft(activeTemplate.name)
  }, [activeTemplate, viewMode])

  useEffect(() => {
    if (viewMode === 'doc') {
      setTitleDraft(activeDoc?.title ?? '')
    } else {
      setTitleDraft(activeTemplate?.name ?? '')
    }
  }, [viewMode, activeDoc, activeTemplate])

  useEffect(() => {
    if (viewMode !== 'template') return
    if (!activeTemplate && templates.length) {
      setActiveTemplate(templates[0])
    }
  }, [viewMode, templates, activeTemplate])

  useEffect(() => {
    if (!templateEditor || !templateEditorRef.current) return
    templateEditorRef.current.innerHTML = templateEditor.content || ''
  }, [templateEditor])

  const matchedDocs = useMemo(() => {
    const q = findCommitQuery.trim()
    if (!q) return []
    return docs.filter((doc) => doc.title.includes(q) || doc.snippet.includes(q))
  }, [docs, findCommitQuery])

  const highlight = (text: string, query: string) => {
    if (!query) return text
    const parts = text.split(query)
    if (parts.length === 1) return text
    return (
      <>
        {parts.map((part, idx) => (
          <span key={`${part}-${idx}`}>
            {part}
            {idx < parts.length - 1 ? <mark className='highlight'>{query}</mark> : null}
          </span>
        ))}
      </>
    )
  }
  const recentTemplates = useMemo(() => templates.slice(0, 10), [templates])
  const filteredTemplates = useMemo(() => {
    const key = templateSearch.trim()
    if (!key) return templates
    return templates.filter((item) => item.name.includes(key))
  }, [templateSearch, templates])

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

  const handleSelectDoc = async (docId: number) => {
    const detail = await window.api.db.getDoc(docId)
    setActiveDoc(detail)
  }

  const handleSelectTemplate = (templateId: number) => {
    const item = templates.find((tpl) => tpl.id === templateId) ?? null
    setActiveTemplate(item)
  }

  const handleSave = async () => {
    if (!editorRef.current) return
    if (viewMode === 'doc') {
      if (!activeDoc) return
      const next = await window.api.db.saveDoc({
        id: activeDoc.id,
        title: titleDraft.trim() || activeDoc.title,
        content: editorRef.current.innerHTML,
      })
      setActiveDoc(next)
      if (next) {
        const nextDocs = docs.map((doc) =>
          doc.id === next.id ? { ...doc, title: next.title, updatedAt: next.updatedAt, snippet: stripHtml(next.content || '').slice(0, 120) } : doc
        )
        syncTreeWithDocs(nextDocs)
      }
      return
    }
    if (viewMode === 'template') {
      if (!activeTemplate) return
      const next = {
        ...activeTemplate,
        name: titleDraft.trim() || activeTemplate.name,
        content: editorRef.current.innerHTML,
      }
      await window.api.db.updateTemplate({
        id: activeTemplate.id,
        name: next.name,
        content: next.content,
        folderId: next.folderId ?? null,
      })
      setActiveTemplate(next)
      const nextTemplates = templates.map((tpl) => (tpl.id === next.id ? { ...tpl, name: next.name, content: next.content, updatedAt: new Date().toISOString() } : tpl))
      syncTreeWithTemplates(nextTemplates)
    }
  }

  const handleTitleBlur = async () => {
    if (!titleDraft.trim()) {
      if (viewMode === 'doc' && activeDoc) setTitleDraft(activeDoc.title)
      if (viewMode === 'template' && activeTemplate) setTitleDraft(activeTemplate.name)
      return
    }
    if (viewMode === 'doc') {
      if (!activeDoc) return
      if (titleDraft.trim() === activeDoc.title) return
      const detail = await window.api.db.renameDoc({ id: activeDoc.id, title: titleDraft.trim() })
      if (detail) setActiveDoc(detail)
      if (detail) {
        const nextDocs = docs.map((doc) => (doc.id === detail.id ? { ...doc, title: detail.title, updatedAt: detail.updatedAt } : doc))
        syncTreeWithDocs(nextDocs)
      }
      return
    }
    if (viewMode === 'template') {
      if (!activeTemplate) return
      if (titleDraft.trim() === activeTemplate.name) return
      await window.api.db.updateTemplate({
        id: activeTemplate.id,
        name: titleDraft.trim(),
        content: activeTemplate.content,
        folderId: activeTemplate.folderId ?? null,
      })
      const next = { ...activeTemplate, name: titleDraft.trim() }
      setActiveTemplate(next)
      const nextTemplates = templates.map((tpl) => (tpl.id === next.id ? { ...tpl, name: next.name } : tpl))
      syncTreeWithTemplates(nextTemplates)
    }
  }

  const applyCommand = (command: string, value?: string) => {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command, false, value)
  }

  const applyWithSelection = (fn: () => void) => {
    editorRef.current?.focus()
    restoreSelection()
    fn()
    captureSelection()
  }

  const getSelectedBlocks = () => {
    const container = editorRef.current
    const selection = window.getSelection()
    if (!container || !selection || selection.rangeCount === 0) return []
    const range = selection.getRangeAt(0)
    const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'blockquote', 'li'])
    const nodes = new Set<HTMLElement>()
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_REJECT
          const tag = node.tagName.toLowerCase()
          return blockTags.has(tag) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        },
      },
    )
    while (walker.nextNode()) {
      const el = walker.currentNode as HTMLElement
      if (range.intersectsNode(el)) nodes.add(el)
    }
    if (!nodes.size) {
      let el = selection.focusNode instanceof HTMLElement
        ? selection.focusNode
        : selection.focusNode?.parentElement
      if (!el) {
        el = selection.anchorNode instanceof HTMLElement
          ? selection.anchorNode
          : selection.anchorNode?.parentElement
      }
      if (el === container) {
        el = container.firstElementChild as HTMLElement | null
      }
      while (el && el !== container && !blockTags.has(el.tagName.toLowerCase())) {
        el = el.parentElement
      }
      if (el && el !== container) nodes.add(el)
    }
    return Array.from(nodes)
  }

  const ensureBlocks = () => {
    let blocks = getSelectedBlocks()
    if (!blocks.length) {
      applyCommand('formatBlock', 'p')
      blocks = getSelectedBlocks()
    }
    return blocks
  }

  const applyBlockStyle = (style: 'textAlign' | 'lineHeight', value: string) => {
    const blocks = ensureBlocks()
    blocks.forEach((block) => {
      if (style === 'textAlign') block.style.textAlign = value
      if (style === 'lineHeight') block.style.lineHeight = value
    })
    editorRef.current?.focus()
  }

  const adjustIndent = (delta: number) => {
    const blocks = ensureBlocks()
    blocks.forEach((block) => {
      const current = parseFloat(block.style.marginLeft || '0')
      const next = Math.max(0, current + delta)
      block.style.marginLeft = `${next}px`
    })
    editorRef.current?.focus()
  }

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        adjustIndent(-24)
      } else {
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
        editorRef.current?.focus()
      }
    }
  }

  const handleApplyTemplate = async (templateId: number) => {
    if (!activeDoc) return
    const next = await window.api.db.applyTemplate({ templateId, docId: activeDoc.id })
    setActiveDoc(next)
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

  const handleCreateTemplateFolder = async () => {
    openDialog({
      title: '新建模板文件夹',
      inputLabel: '文件夹名称',
      inputValue: '',
      confirmText: '创建',
      showInput: true,
      onConfirm: async (value) => {
        if (!value) return
        const id = await window.api.db.createTemplateFolder({ name: value, parentId: activeTemplateFolderId })
        if (!id) return
        const newRow: TemplateFolderRow = {
          id,
          name: value,
          parentId: activeTemplateFolderId,
          sortOrder: Date.now(),
        }
        setTemplateFolderRows((prev) => {
          const next = [...prev, newRow]
          setTemplateFolders(buildTree(next, templates.map(toTemplateSummary)))
          return next
        })
      },
    })
  }

  const openCreateMenu = (event: MouseEvent<HTMLElement>, folderId: number | null, mode?: 'submenu') => {
    const rect = event.currentTarget.getBoundingClientRect()
    if (folderId !== null) setActiveFolderId(folderId)
    setMenu({ folderId: folderId ?? 0, x: rect.left, y: rect.bottom + 6, mode })
    setMenuSubOpen(true)
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
        setTemplateFolderRows((prev) => {
          const next = prev.map((row) => (row.id === activeTemplateFolderId ? { ...row, name: value } : row))
          setTemplateFolders(buildTree(next, templates.map(toTemplateSummary)))
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
        setTemplateFolderRows((prev) => {
          const next = prev.filter((row) => !idsToRemove.has(row.id))
          const nextTemplates = templates.map((tpl) =>
            idsToRemove.has(tpl.folderId ?? -1) ? { ...tpl, folderId: null } : tpl
          )
          syncTreeWithTemplates(nextTemplates, next)
          return next
        })
        if (idsToRemove.has(activeTemplateFolderId)) setActiveTemplateFolderId(null)
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

  const handleMenuCreateFromTemplate = async (folderId: number | null, template: TemplateRow) => {
    const detail = await window.api.db.createDoc({
      folderId,
      title: `${template.name}-${new Date().toLocaleDateString()}`,
      content: template.content,
    })
    if (!detail) return
    const nextDocs = [toDocSummary(detail), ...docs]
    syncTreeWithDocs(nextDocs)
    setActiveDoc(detail)
  }

  const handleCreateDocFromTemplateId = async (templateId: number) => {
    const tpl = templates.find((item) => item.id === templateId)
    if (!tpl) return
    await handleMenuCreateFromTemplate(templatePanel?.folderId ?? null, tpl)
  }

  const handleOpenTemplatePanel = (folderId: number | null, mode: 'create' | 'manage') => {
    const targetFolderId = viewMode === 'template' ? activeTemplateFolderId : folderId
    setTemplatePanel({ folderId: targetFolderId ?? null, mode })
  }

  const handleSaveAsTemplate = async () => {
    if (!activeDoc) return
    setTemplatePanel({ folderId: activeTemplateFolderId ?? null, mode: 'create' })
    setTemplateEditor({
      mode: 'create',
      name: activeDoc.title,
      content: editorRef.current?.innerHTML ?? '',
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
    const content = templateEditorRef.current?.innerHTML ?? ''
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

  const handlePrint = async () => {
    await window.api.print()
  }

  const handleExport = async (format: 'pdf' | 'word') => {
    if (!activeDoc) return
    const content = editorRef.current?.innerHTML ?? ''
    await window.api.exportDoc({
      title: titleDraft.trim() || activeDoc.title,
      content,
      format,
    })
  }

  const handleImportTemplates = async () => {
    try {
      await window.api.importTemplates()
      const next = await window.api.db.listTemplates()
      syncTreeWithTemplates(next)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      openDialog({
        title: '导入模板失败',
        message,
        confirmText: '知道了',
        cancelText: '关闭',
        showInput: false,
        onConfirm: async () => {},
      })
    }
  }

  const handleUploadTemplateFiles = async (folderId: number | null) => {
    await window.api.uploadTemplateFiles(folderId)
    const next = await window.api.db.listTemplates()
    syncTreeWithTemplates(next)
  }

  const handleUploadTemplateFolder = async (folderId: number | null) => {
    await window.api.uploadTemplateFolder(folderId)
    const next = await window.api.db.listTemplates()
    syncTreeWithTemplates(next)
  }

  return (
    <div className='app-shell'>
      <aside className='sidebar'>
        <div className='sidebar-header'>
          <div>
            <div className='brand'>文档管理系统</div>
            <div className='brand-sub'>本地 · 安全 · 快速</div>
          </div>
          
        </div>

        <div className='sidebar-scroll'>
          <div className='section'>
            <div className='section-title'>快捷工具</div>
            {/* <div className='quick-item clickable' onClick={(event) => openCreateMenu(event, activeFolderId, 'submenu')}>
              <span className='quick-icon'>＋</span>
              新建
            </div>
            <div className='quick-item clickable' onClick={() => handleOpenTemplatePanel(activeFolderId, 'create')}>
              <span className='quick-icon'>▦</span>
              模板
            </div> */}
            <div className='quick-item clickable' onClick={() => setFindReplaceOpen(true)}>
              <span className='quick-icon'>⌕</span>
              查找替换
            </div>
          </div>

          <div className='section'>
            <div className='section-title-row'>
              <div className='section-title'>{viewMode === 'doc' ? '我的文档' : '我的模板'}</div>
              <span
                className='section-link'
                onClick={() => setViewMode(viewMode === 'doc' ? 'template' : 'doc')}
              >
                {viewMode === 'doc' ? '切换模板' : '切换文档'}
              </span>
            </div>
            <div className='tree'>
              {viewMode === 'doc' ? (
                <>
                  <button
                    className={`tree-row ${activeFolderId === null ? 'active' : ''}`}
                    onClick={() => handleSelectFolder(null)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setMenu({ folderId: 0, x: event.clientX, y: event.clientY })
                      setMenuSubOpen(false)
                    }}
                  >
                    <span className='tree-dot' />
                    <span className='tree-icon' />
                    <span className='tree-name'>全部文档</span>
                  </button>
                  {renderTree(
                    folders,
                    0,
                    activeFolderId,
                    handleSelectFolder,
                    collapsedFolders,
                    handleToggleFolder,
                    (id, x, y) => {
                      setActiveFolderId(id)
                      setMenu({ folderId: id, x, y })
                      setMenuSubOpen(false)
                    },
                    hoverFolderId,
                    setHoverFolderId,
                    handleSelectDoc,
                    activeDoc?.id ?? null,
                    (id, x, y) => {
                      setDocMenu({ docId: id, x, y })
                    },
                  )}
                </>
              ) : (
                <>
                  <button
                    className={`tree-row ${activeTemplateFolderId === null ? 'active' : ''}`}
                    onClick={() => handleSelectTemplateFolder(null)}
                    onContextMenu={(event) => {
                      event.preventDefault()
                      setMenu({ folderId: 0, x: event.clientX, y: event.clientY })
                      setMenuSubOpen(false)
                    }}
                  >
                    <span className='tree-dot' />
                    <span className='tree-icon' />
                    <span className='tree-name'>全部模板</span>
                  </button>
                  {renderTree(
                    templateFolders,
                    0,
                    activeTemplateFolderId,
                    handleSelectTemplateFolder,
                    collapsedTemplateFolders,
                    handleToggleTemplateFolder,
                    (id, x, y) => {
                      setActiveTemplateFolderId(id)
                      setMenu({ folderId: id, x, y })
                      setMenuSubOpen(false)
                    },
                    hoverFolderId,
                    setHoverFolderId,
                    handleSelectTemplate,
                    activeTemplate?.id ?? null,
                    (id, x, y) => {
                      setTemplateMenu({ docId: id, x, y })
                    },
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </aside>

      

      <section className='editor'>
        <div className='editor-toolbar'>
          <div className='editor-title-bar'>
            <div className='editor-title-left'>
              <input
                className='doc-title-input'
                value={titleDraft}
                onChange={(event) => setTitleDraft(event.target.value)}
                onBlur={handleTitleBlur}
                placeholder='请输入标题'
                disabled={viewMode === 'doc' ? !activeDoc : !activeTemplate}
              />
            </div>
            <div className='editor-title-right'>
             {/*  {viewMode === 'doc' ? (
                <button className='tool emphasize' onClick={() => handleOpenTemplatePanel(activeFolderId, 'create')}>模板</button>
              ) : (
                <button className='tool emphasize' onClick={() => handleCreateTemplate(activeTemplateFolderId)}>新建模板</button>
              )} */}
             {/*  <span
                className='link-toggle'
                onClick={() => setViewMode(viewMode === 'doc' ? 'template' : 'doc')}
              >
                {viewMode === 'doc' ? '切换模板' : '切换文档'}
              </span> */}
              <div className='editor-menu-wrap'>
                <button className='tool' onClick={() => setEditorMenuOpen((prev) => !prev)}>•••</button>
                {editorMenuOpen ? (
                  <div className='menu editor-menu'>
                    {viewMode === 'doc' ? (
                      <>
                        <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handleSaveAsTemplate() }} disabled={!activeDoc}>
                          设为模板
                        </button>
                        <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handleExport('pdf') }} disabled={!activeDoc}>
                          导出 PDF
                        </button>
                        <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handleExport('word') }} disabled={!activeDoc}>
                          导出 Word
                        </button>
                        <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handlePrint() }} disabled={!activeDoc}>
                          打印
                        </button>
                        <button className='menu-item danger' onClick={() => { setEditorMenuOpen(false); handleDeleteDoc() }} disabled={!activeDoc}>
                          删除
                        </button>
                      </>
                    ) : (
                      <button className='menu-item danger' onClick={() => { setEditorMenuOpen(false); handleDeleteTemplate() }} disabled={!activeTemplate}>
                        删除模板
                      </button>
                    )}
                  </div>
                ) : null}
          </div>
            </div>
          </div>
        </div>

        <div className='editor-format'>
          <button className='tool icon' onClick={() => applyCommand('undo')}>↶</button>
          <button className='tool icon' onClick={() => applyCommand('redo')}>↷</button>
          <select
            className='tool-select'
            onMouseDown={(event) => {
              suppressSelectionRef.current = true
              captureSelection()
              setTimeout(() => { suppressSelectionRef.current = false }, 0)
            }}
            onChange={(event) => {
              applyWithSelection(() => applyCommand('formatBlock', event.target.value))
            }}
            defaultValue='p'
          >
            <option value='p'>正文</option>
            <option value='h1'>标题 1</option>
            <option value='h2'>标题 2</option>
            <option value='blockquote'>引用</option>
          </select>
          <select
            className='tool-select'
            onMouseDown={(event) => {
              suppressSelectionRef.current = true
              captureSelection()
              setTimeout(() => { suppressSelectionRef.current = false }, 0)
            }}
            onChange={(event) => {
              applyWithSelection(() => applyCommand('fontSize', event.target.value))
            }}
            defaultValue='3'
          >
            <option value='2'>12</option>
            <option value='3'>14</option>
            <option value='4'>16</option>
            <option value='5'>18</option>
            <option value='6'>20</option>
          </select>
          <select
            className='tool-select'
            value={lineHeight}
            onMouseDown={(event) => {
              suppressSelectionRef.current = true
              captureSelection()
              setTimeout(() => { suppressSelectionRef.current = false }, 0)
            }}
            onChange={(event) => {
              setLineHeight(event.target.value)
              applyWithSelection(() => applyBlockStyle('lineHeight', event.target.value))
            }}
          >
            <option value='1.4'>行距 1.4</option>
            <option value='1.6'>行距 1.6</option>
            <option value='1.8'>行距 1.8</option>
            <option value='2.0'>行距 2.0</option>
            <option value='2.4'>行距 2.4</option>
          </select>
          <button className='tool' onClick={() => applyWithSelection(() => applyCommand('bold'))}>B</button>
          <button className='tool' onClick={() => applyWithSelection(() => applyCommand('italic'))}>I</button>
          <button className='tool' onClick={() => applyWithSelection(() => applyCommand('underline'))}>U</button>
          <button
            className='tool'
            onClick={() => {
              applyWithSelection(() => {
                applyCommand('removeFormat')
                applyCommand('unlink')
              })
            }}
          >
            清除样式
          </button>
          <button className='tool' onClick={() => applyWithSelection(() => applyBlockStyle('textAlign', 'left'))}>左</button>
          <button className='tool' onClick={() => applyWithSelection(() => applyBlockStyle('textAlign', 'center'))}>中</button>
          <button className='tool' onClick={() => applyWithSelection(() => applyBlockStyle('textAlign', 'right'))}>右</button>
          <button className='tool' onClick={() => applyWithSelection(() => adjustIndent(24))}>缩进</button>
          <button className='tool' onClick={() => applyWithSelection(() => adjustIndent(-24))}>减少缩进</button>
        </div>

        <div className='editor-meta'>
          <div className='doc-badge'>文档</div>
          <div className='doc-info'>
            更新时间：{activeDoc ? formatDate(activeDoc.updatedAt) : '--'} · 创建时间：
            {activeDoc ? formatDate(activeDoc.createdAt) : '--'}
          </div>
        </div>

        <div className='editor-canvas'>
          <div
            className='editor-paper'
            contentEditable
            suppressContentEditableWarning
            ref={editorRef}
            style={{ lineHeight }}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={captureSelection}
            onMouseUp={captureSelection}
            onMouseDown={() => { suppressSelectionRef.current = false }}
            onBlur={handleSave}
          />
        </div>
      </section>

      {dialog ? (
        <div className='modal-backdrop' onClick={closeDialog}>
          <div className='modal' onClick={(event) => event.stopPropagation()}>
            <div className='modal-title'>{dialog.title}</div>
            {dialog.message ? <div className='modal-message'>{dialog.message}</div> : null}
            {dialog.showInput ? (
              <label className='modal-field'>
                <span>{dialog.inputLabel ?? '名称'}</span>
                <input
                  value={dialogValue}
                  onChange={(event) => setDialogValue(event.target.value)}
                  autoFocus
                />
              </label>
            ) : null}
            <div className='modal-actions'>
              <button className='ghost' onClick={closeDialog}>{dialog.cancelText ?? '取消'}</button>
              <button
                className={`primary ${dialog.confirmText === '删除' ? 'danger' : ''}`}
                onClick={handleDialogConfirm}
              >
                {dialog.confirmText ?? '确定'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {menu ? (
        <>
          <div className='menu-backdrop' onClick={() => { setMenu(null); setMenuSubOpen(false) }} />
          <div
            className='menu-stack'
            style={{ top: menu.y, left: menu.x }}
            onMouseLeave={() => setMenuSubOpen(false)}
            onClick={(event) => event.stopPropagation()}
          >
            {menu.mode !== 'submenu' ? (
              <div className='menu main'>
              <button className='menu-item with-arrow' onMouseEnter={() => setMenuSubOpen(true)}>
                <span>新建</span>
                <span className='menu-arrow'>›</span>
              </button>
              <div className='menu-divider' />
              <button
                className='menu-item'
                disabled={menu.folderId === 0}
                onClick={() => {
                  setMenu(null)
                  if (viewMode === 'doc') {
                    handleRenameFolder()
                  } else {
                    handleRenameTemplateFolder()
                  }
                }}
              >
                重命名
              </button>
              {viewMode === 'template' ? (
                <>
                  <div className='menu-divider' />
                  <button
                    className='menu-item'
                    onClick={async () => {
                      setMenu(null)
                      const targetFolderId = menu.folderId === 0 ? activeTemplateFolderId : menu.folderId
                      await handleUploadTemplateFiles(typeof targetFolderId === 'number' ? targetFolderId : null)
                    }}
                  >
                    上传文件
                  </button>
                  <button
                    className='menu-item'
                    onClick={async () => {
                      setMenu(null)
                      const targetFolderId = menu.folderId === 0 ? activeTemplateFolderId : menu.folderId
                      await handleUploadTemplateFolder(typeof targetFolderId === 'number' ? targetFolderId : null)
                    }}
                  >
                    上传文件夹
                  </button>
                </>
              ) : null}
              <button
                className='menu-item danger'
                disabled={menu.folderId === 0}
                onClick={() => {
                  setMenu(null)
                  if (viewMode === 'doc') {
                    handleDeleteFolder()
                  } else {
                    handleDeleteTemplateFolder()
                  }
                }}
              >
                删除
              </button>
            </div>
            ) : null}
            {(menuSubOpen || menu.mode === 'submenu') ? (
              <div className='menu submenu' onMouseEnter={() => setMenuSubOpen(true)}>
                <button
                  className='menu-item'
                  onClick={() => {
                    setMenu(null)
                    if (viewMode === 'doc') {
                      const targetFolderId = menu.folderId === 0 ? activeFolderId : menu.folderId
                      if (typeof targetFolderId === 'number') {
                        handleMenuCreateDoc(targetFolderId)
                      }
                    } else {
                      const targetFolderId = menu.folderId === 0 ? activeTemplateFolderId : menu.folderId
                      handleCreateTemplate(typeof targetFolderId === 'number' ? targetFolderId : null)
                    }
                  }}
                >
                  {viewMode === 'doc' ? '空白文档' : '空白模板'}
                </button>
                {viewMode === 'doc' ? (
                  <button
                    className='menu-item'
                    onClick={() => {
                      setMenu(null)
                      handleOpenTemplatePanel(menu.folderId === 0 ? activeFolderId : menu.folderId, 'create')
                    }}
                  >
                    从模板新建
                  </button>
                ) : null}
                <button
                  className='menu-item'
                  onClick={() => {
                    setMenu(null)
                    if (viewMode === 'doc') {
                      handleCreateFolder()
                    } else {
                      handleCreateTemplateFolder()
                    }
                  }}
                >
                  文件夹
                </button>
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {docMenu ? (
        <>
          <div className='menu-backdrop' onClick={() => setDocMenu(null)} />
          <div className='menu doc-menu' style={{ top: docMenu.y, left: docMenu.x }}>
            <button
              className='menu-item'
              onClick={async () => {
                setDocMenu(null)
                await handleSelectDoc(docMenu.docId)
                await handleRenameDoc()
              }}
            >
              重命名
            </button>
            <button
              className='menu-item'
              onClick={async () => {
                setDocMenu(null)
                await handleSelectDoc(docMenu.docId)
                await handleCopyDoc()
              }}
            >
              复制
            </button>
            <button
              className='menu-item danger'
              onClick={async () => {
                setDocMenu(null)
                await handleSelectDoc(docMenu.docId)
                await handleDeleteDoc()
              }}
            >
              删除
            </button>
          </div>
        </>
      ) : null}

      {templateMenu ? (
        <>
          <div className='menu-backdrop' onClick={() => setTemplateMenu(null)} />
          <div className='menu doc-menu' style={{ top: templateMenu.y, left: templateMenu.x }}>
            <button
              className='menu-item'
              onClick={async () => {
                setTemplateMenu(null)
                handleSelectTemplate(templateMenu.docId)
                await handleRenameTemplate()
              }}
            >
              重命名
            </button>
            <button
              className='menu-item'
              onClick={async () => {
                setTemplateMenu(null)
                handleSelectTemplate(templateMenu.docId)
                await handleCopyTemplate()
              }}
            >
              复制
            </button>
            <button
              className='menu-item danger'
              onClick={async () => {
                setTemplateMenu(null)
                handleSelectTemplate(templateMenu.docId)
                await handleDeleteTemplate()
              }}
            >
              删除
            </button>
          </div>
        </>
      ) : null}

      {templatePanel ? (
        <div className='panel-backdrop' onClick={() => setTemplatePanel(null)}>
          <div className='panel' onClick={(event) => event.stopPropagation()}>
            <div className='panel-header'>
              <div className='panel-title'>我的模板</div>
              <button className='ghost' onClick={() => setTemplatePanel(null)}>关闭</button>
            </div>
            <div className='panel-body'>
              <div className='panel-search'>
                <input
                  placeholder='搜索模板名称'
                  value={templateSearch}
                  onChange={(event) => setTemplateSearch(event.target.value)}
                />
              </div>
              {templatePanel.mode === 'create' ? (
                <div className='panel-template-select'>
                  <div className='panel-tree'>
                    <button className={`tree-row ${activeTemplateFolderId === null ? 'active' : ''}`} onClick={() => handleSelectTemplateFolder(null)}>
                      <span className='tree-dot' />
                      <span className='tree-icon' />
                      <span className='tree-name'>全部模板</span>
                    </button>
                    {renderTree(
                      templateFolders,
                      0,
                      activeTemplateFolderId,
                      handleSelectTemplateFolder,
                      collapsedTemplateFolders,
                      handleToggleTemplateFolder,
                      () => {},
                      hoverFolderId,
                      setHoverFolderId,
                      (id) => setTemplatePickId(id),
                      null,
                      () => {},
                    )}
                  </div>
                  <div className='panel-preview'>
                    {templatePickId ? (
                      <>
                        <div className='panel-preview-title'>
                          {templates.find((tpl) => tpl.id === templatePickId)?.name ?? '模板预览'}
                        </div>
                        <div
                          className='panel-preview-body'
                          dangerouslySetInnerHTML={{
                            __html: templates.find((tpl) => tpl.id === templatePickId)?.content ?? '',
                          }}
                        />
                        <button
                          className='primary'
                          onClick={() => {
                            handleCreateDocFromTemplateId(templatePickId)
                            setTemplatePanel(null)
                            setTemplatePickId(null)
                          }}
                        >
                          使用该模板
                        </button>
                      </>
                    ) : (
                      <div className='panel-empty'>请选择左侧模板进行预览</div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {filteredTemplates.length ? filteredTemplates.map((tpl) => (
                    <div key={tpl.id} className='panel-row'>
                      <div>
                        <div className='panel-name'>{tpl.name}</div>
                        <div className='panel-date'>{formatDate(tpl.updatedAt)}</div>
                      </div>
                      <div className='panel-actions'>
                        <button className='ghost' onClick={() => handleEditTemplate(tpl)}>编辑</button>
                        <button className='ghost danger' onClick={() => handleDeleteTemplate()}>删除</button>
                      </div>
                    </div>
                  )) : (
                    <div className='panel-empty'>暂无模板</div>
                  )}
                </>
              )}
            </div>
            {templatePanel.mode === 'manage' ? (
              <div className='panel-footer'>
                <button className='ghost' onClick={() => handleOpenTemplateEditor('create')}>新增模板</button>
                <button className='ghost' onClick={handleImportTemplates}>
                  导入模板
                </button>
                <button className='primary' onClick={handleSaveAsTemplate} disabled={!activeDoc}>保存当前文档为模板</button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {templateEditor ? (
        <div className='panel-backdrop' onClick={() => setTemplateEditor(null)}>
          <div className='panel editor-panel' onClick={(event) => event.stopPropagation()}>
            <div className='panel-header'>
              <div className='panel-title'>{templateEditor.mode === 'create' ? '新建模板' : '编辑模板'}</div>
              <button className='ghost' onClick={() => setTemplateEditor(null)}>关闭</button>
            </div>
            <div className='panel-body'>
              <label className='panel-field'>
                <span>模板名称</span>
                <input
                  value={templateEditor.name}
                  onChange={(event) => setTemplateEditor({ ...templateEditor, name: event.target.value })}
                />
              </label>
              <label className='panel-field'>
                <span>模板内容（支持富文本粘贴）</span>
                <div
                  className='template-editor'
                  contentEditable
                  suppressContentEditableWarning
                  ref={templateEditorRef}
                />
              </label>
            </div>
            <div className='panel-footer'>
              <button className='ghost' onClick={() => setTemplateEditor(null)}>取消</button>
              <button className='primary' onClick={handleTemplateEditorSave}>保存</button>
            </div>
          </div>
        </div>
      ) : null}

      {findReplaceOpen ? (
        <div className='panel-backdrop' onClick={() => setFindReplaceOpen(false)}>
          <div className='panel editor-panel' onClick={(event) => event.stopPropagation()}>
            <div className='panel-header'>
              <div className='panel-title'>查找替换</div>
              <button className='ghost' onClick={() => setFindReplaceOpen(false)}>关闭</button>
            </div>
            <div className='panel-body'>
              <label className='panel-field'>
                <span>查找内容</span>
                <input
                  value={findQuery}
                  onChange={(event) => setFindQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      setFindCommitQuery(findQuery)
                    }
                  }}
                  placeholder='回车执行查找'
                />
              </label>
              <label className='panel-field'>
                <span>替换为</span>
                <input value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} />
              </label>
              <div className='panel-hint'>范围：当前文件夹（全部文档时为全库）</div>
              {findCommitQuery.trim() ? (
                <div className='panel-results'>
                  <div className='panel-hint'>匹配到 {matchedDocs.length} 篇文档</div>
                  <div className='panel-result-list'>
                    {matchedDocs.map((doc) => (
                      <div key={doc.id} className='panel-result'>
                        <div className='panel-result-title'>{highlight(doc.title, findCommitQuery)}</div>
                        <div className='panel-result-snippet'>{highlight(doc.snippet || '暂无摘要', findCommitQuery)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
          </div>
            <div className='panel-footer'>
              <button className='ghost' onClick={() => setFindReplaceOpen(false)}>取消</button>
              <button
                className='primary'
                disabled={!findQuery.trim()}
                onClick={async () => {
                  setFindCommitQuery(findQuery)
                  const updated = await window.api.db.findReplace({
                    query: findQuery,
                    replace: replaceQuery,
                    folderId: activeFolderId,
                  })
                  await refreshDocs(activeFolderId)
                  setFindReplaceOpen(false)
                  openDialog({
                    title: '替换完成',
                    message: `共更新 ${updated} 篇文档`,
                    confirmText: '知道了',
                    showInput: false,
                    onConfirm: () => {},
                  })
                }}
              >
                执行替换
              </button>
            </div>
          </div>
        </div>
      ) : null}
          </div>
  )
}

export default App




