import type { CSSProperties, MouseEvent } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

type FolderNode = {
  id: number
  name: string
  parentId: number | null
  children: FolderNode[]
}

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

function buildTree(rows: FolderRow[]): FolderNode[] {
  const map = new Map<number, FolderNode>()
  const roots: FolderNode[] = []

  rows.forEach((row) => {
    map.set(row.id, { id: row.id, name: row.name, parentId: row.parentId, children: [] })
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

  const sortTree = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
    nodes.forEach((child) => sortTree(child.children))
  }
  sortTree(roots)

  return roots
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
) {
  return nodes.map((node) => (
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
          onClick={() => onSelect?.(node.id)}
        >
          {node.children.length ? (
            <span
              className='tree-toggle'
              onClick={(event) => {
                event.stopPropagation()
                onToggle(node.id)
              }}
            >
              {collapsed.has(node.id) ? '+' : '-'}
            </span>
          ) : (
            <span/>
          )}
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
          )}
        </div>
      ) : null}
          </div>
  ))
}

function App() {
  const [folderRows, setFolderRows] = useState<FolderRow[]>([])
  const [folders, setFolders] = useState<FolderNode[]>([])
  const [docs, setDocs] = useState<DocSummary[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [activeFolderId, setActiveFolderId] = useState<number | null>(null)
  const [activeDoc, setActiveDoc] = useState<DocDetail | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dialogValue, setDialogValue] = useState('')
  const [collapsedFolders, setCollapsedFolders] = useState<Set<number>>(new Set())
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [hoverFolderId, setHoverFolderId] = useState<number | null>(null)
  const [templatePanel, setTemplatePanel] = useState<TemplatePanelState | null>(null)
  const [templateEditor, setTemplateEditor] = useState<TemplateEditorState | null>(null)
  const [menuSubOpen, setMenuSubOpen] = useState(false)
  const [templateSearch, setTemplateSearch] = useState('')
  const templateEditorRef = useRef<HTMLDivElement | null>(null)
  const [docMenu, setDocMenu] = useState<DocMenuState | null>(null)
  const [hoverDocId, setHoverDocId] = useState<number | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [editorMenuOpen, setEditorMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [replaceQuery, setReplaceQuery] = useState('')
  const [findCommitQuery, setFindCommitQuery] = useState('')

  const folderMap = useMemo(() => new Map(folderRows.map((row) => [row.id, row])), [folderRows])

  const refreshFolders = async () => {
    const rows = await window.api.db.listFolders()
    setFolderRows(rows)
    setFolders(buildTree(rows))
    // default collapsed
    const collapsed = new Set<number>()
    rows.forEach((row) => {
      if (rows.some((child) => child.parentId === row.id)) {
        collapsed.add(row.id)
      }
    })
    setCollapsedFolders(collapsed)
  }

  const refreshDocs = async (folderId: number | null) => {
    const list = await window.api.db.listDocs(folderId)
    setDocs(list)
    if (list.length) {
      const detail = await window.api.db.getDoc(list[0].id)
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
      }
      return next
    })
  }

  useEffect(() => {
    const boot = async () => {
      await window.api.db.init()
      const [templateRows] = await Promise.all([
        window.api.db.listTemplates(),
        refreshFolders(),
      ])
      setTemplates(templateRows)
      await refreshDocs(null)
    }
    boot()
  }, [])

  useEffect(() => {
    if (!activeDoc || !editorRef.current) return
    editorRef.current.innerHTML = activeDoc.content || ''
    setTitleDraft(activeDoc.title)
  }, [activeDoc])

  useEffect(() => {
    if (!templateEditor || !templateEditorRef.current) return
    templateEditorRef.current.innerHTML = templateEditor.content || ''
  }, [templateEditor])

  const docList = useMemo(() => {
    if (!searchQuery.trim()) return docs
    const q = searchQuery.trim()
    return docs.filter((doc) => doc.title.includes(q) || doc.snippet.includes(q))
  }, [docs, searchQuery])
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
    await refreshDocs(folderId)
  }

  const handleSelectDoc = async (docId: number) => {
    const detail = await window.api.db.getDoc(docId)
    setActiveDoc(detail)
  }

  const handleSave = async () => {
    if (!activeDoc || !editorRef.current) return
    const next = await window.api.db.saveDoc({
      id: activeDoc.id,
      title: titleDraft.trim() || activeDoc.title,
      content: editorRef.current.innerHTML,
    })
    setActiveDoc(next)
    const list = await window.api.db.listDocs(activeFolderId)
    setDocs(list)
  }

  const handleTitleBlur = async () => {
    if (!activeDoc) return
    if (!titleDraft.trim()) {
      setTitleDraft(activeDoc.title)
      return
    }
    if (titleDraft.trim() === activeDoc.title) return
    const detail = await window.api.db.renameDoc({ id: activeDoc.id, title: titleDraft.trim() })
    if (detail) setActiveDoc(detail)
    const list = await window.api.db.listDocs(activeFolderId)
    setDocs(list)
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
        await window.api.db.createFolder({ name: value, parentId: activeFolderId })
        await refreshFolders()
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
        await refreshFolders()
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
        setActiveFolderId(null)
        await refreshFolders()
        await refreshDocs(null)
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
        await refreshDocs(activeFolderId)
        if (detail) setActiveDoc(detail)
      },
    })
  }

  const handleMenuCreateFromTemplate = async (folderId: number | null, template: TemplateRow) => {
    const detail = await window.api.db.createDoc({
      folderId,
      title: `${template.name}-${new Date().toLocaleDateString()}`,
      content: template.content,
    })
    await refreshDocs(activeFolderId)
    if (detail) setActiveDoc(detail)
  }

  const handleOpenTemplatePanel = (folderId: number | null, mode: 'create' | 'manage') => {
    setTemplatePanel({ folderId, mode })
  }

  const handleSaveAsTemplate = async () => {
    if (!activeDoc) return
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

  const handleDeleteTemplate = async (template: TemplateRow) => {
    openDialog({
      title: '删除模板',
      message: `确定删除模板「${template.name}」吗？`,
      confirmText: '删除',
      showInput: false,
      onConfirm: async () => {
        await window.api.db.deleteTemplate(template.id)
        const nextTemplates = await window.api.db.listTemplates()
        setTemplates(nextTemplates)
      },
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
      await window.api.db.createTemplate({ name: templateEditor.name.trim(), content })
    } else if (templateEditor.id) {
      await window.api.db.updateTemplate({
        id: templateEditor.id,
        name: templateEditor.name.trim(),
        content,
      })
    }
    const nextTemplates = await window.api.db.listTemplates()
    setTemplates(nextTemplates)
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
        await refreshDocs(activeFolderId)
        if (detail) setActiveDoc(detail)
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
        const list = await window.api.db.listDocs(activeFolderId)
        setDocs(list)
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
        await refreshDocs(activeFolderId)
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
    await refreshDocs(activeFolderId)
    if (detail) setActiveDoc(detail)
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
      setTemplates(next)
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
            <div className='quick-item clickable' onClick={(event) => openCreateMenu(event, activeFolderId, 'submenu')}>
              <span className='quick-icon'>＋</span>
              新建
            </div>
            <div className='quick-item clickable' onClick={() => handleOpenTemplatePanel(activeFolderId, 'create')}>
              <span className='quick-icon'>▦</span>
              模板
            </div>
            <div className='quick-item clickable' onClick={() => setFindReplaceOpen(true)}>
              <span className='quick-icon'>⌕</span>
              查找替换
            </div>
          </div>

          <div className='section'>
            <div className='section-title'>我的文件夹</div>
            <div className='tree'>
              <button className={`tree-row ${activeFolderId === null ? 'active' : ''}`} onClick={() => handleSelectFolder(null)}>
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
            )}
            </div>
           {/*  <div className='folder-actions'>
              <button className='ghost' onClick={(event) => openCreateMenu(event, activeFolderId)}>新建</button>
              <button className='ghost' onClick={handleRenameFolder} disabled={!activeFolderId}>重命名</button>
              <button className='ghost danger' onClick={handleDeleteFolder} disabled={!activeFolderId}>删除</button>
            </div> */}
          </div>

          <div className='section'>
            <div className='section-title-row'>
              <div className='section-title'>最近模板</div>
              <button className='ghost small' onClick={() => handleOpenTemplatePanel(null, 'manage')}>管理</button>
            </div>
            <div className='template-grid'>
              {recentTemplates.map((item) => (
                <button key={item.id} className='template-pill' onClick={() => handleMenuCreateFromTemplate(activeFolderId, item)}>
                  {item.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </aside>

      <section className='list'>
        <div className='list-header'>
          <div className='search'>
            <input
              type='text'
              placeholder='搜索文档'
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            <span className='kbd'>Ctrl + K</span>
          </div>
        </div>

        <div className='list-body'>
          {docList.map((doc, index) => (
            <div
              key={doc.id}
              className={`doc-card ${activeDoc?.id === doc.id ? 'active' : ''}`}
              style={{ '--i': index } as CSSProperties}
              onMouseEnter={() => setHoverDocId(doc.id)}
              onMouseLeave={() => setHoverDocId(null)}
              onContextMenu={(event) => {
                event.preventDefault()
                setDocMenu({ docId: doc.id, x: event.clientX, y: event.clientY })
              }}
            >
              <button className='doc-main' onClick={() => handleSelectDoc(doc.id)}>
                <div className='doc-header'>
                  <div>
                    <div className='doc-title-row'>
                      <span className='doc-icon' />
                    <div className='doc-title'>{highlight(doc.title, searchQuery)}</div>
                    </div>
                  <div className='doc-subtitle'>{highlight(doc.snippet || '暂无摘要', searchQuery)}</div>
                  </div>
                  <span className='doc-tag'>文档</span>
                </div>
                <div className='doc-meta'>
                  <span>{formatDate(doc.updatedAt)}</span>
                  <span className='dot' />
                  <span>{formatSize(doc.size)}</span>
                </div>
              </button>
             {/*  <button
                className={`doc-more ${hoverDocId === doc.id ? 'visible' : ''}`}
                onClick={(event) => {
                  event.stopPropagation()
                  const rect = event.currentTarget.getBoundingClientRect()
                  setDocMenu({ docId: doc.id, x: rect.left, y: rect.bottom + 6 })
                }}
              >
                •••
              </button> */}
            </div>
          ))}
        </div>
      </section>

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
                disabled={!activeDoc}
              />
            </div>
            <div className='editor-title-right'>
{/*               <button className='tool emphasize' onClick={() => handleOpenTemplatePanel(activeFolderId, 'create')}>模板</button>
 */}              <div className='editor-menu-wrap'>
                <button className='tool' onClick={() => setEditorMenuOpen((prev) => !prev)}>•••</button>
                {editorMenuOpen ? (
                  <div className='menu editor-menu'>
                    <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handleSaveAsTemplate() }} disabled={!activeDoc}>
                      设为模板
                    </button>
                    <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handleExport('pdf') }} disabled={!activeDoc}>
                      导出 PDF
                    </button>
                    <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handleExport('word') }} disabled={!activeDoc}>
                      导出 Word
                    </button>
                    <button className='menu-item' onClick={() => { setEditorMenuOpen(false); handlePrint() }}>
                      打印
                    </button>
                    <button className='menu-item danger' onClick={() => { setEditorMenuOpen(false); handleDeleteDoc() }} disabled={!activeDoc}>
                      删除
                    </button>
                  </div>
                ) : null}
          </div>
            </div>
          </div>
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
                onClick={() => { setMenu(null); handleRenameFolder() }}
              >
                重命名
              </button>
              <button
                className='menu-item danger'
                disabled={menu.folderId === 0}
                onClick={() => { setMenu(null); handleDeleteFolder() }}
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
                    const targetFolderId = menu.folderId === 0 ? activeFolderId : menu.folderId
                    if (typeof targetFolderId === 'number') {
                      handleMenuCreateDoc(targetFolderId)
                    }
                  }}
                >
                  空白文档
                </button>
                <button
                  className='menu-item'
                  onClick={() => {
                    setMenu(null)
                    handleOpenTemplatePanel(menu.folderId === 0 ? activeFolderId : menu.folderId, 'create')
                  }}
                >
                  从模板新建
                </button>
                <button
                  className='menu-item'
                  onClick={() => {
                    setMenu(null)
                    handleCreateFolder()
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

      {templatePanel ? (
        <div className='panel-backdrop' onClick={() => setTemplatePanel(null)}>
          <div className='panel' onClick={(event) => event.stopPropagation()}>
            <div className='panel-header'>
              <div className='panel-title'>最近模板</div>
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
              {filteredTemplates.length ? filteredTemplates.map((tpl) => (
                <div key={tpl.id} className='panel-row'>
                  <div>
                    <div className='panel-name'>{tpl.name}</div>
                    <div className='panel-date'>{formatDate(tpl.updatedAt)}</div>
                  </div>
                  <div className='panel-actions'>
                    {templatePanel.mode === 'create' ? (
                      <button className='ghost' onClick={() => { setTemplatePanel(null); handleMenuCreateFromTemplate(templatePanel.folderId ?? null, tpl) }}>
                        使用
                      </button>
                    ) : (
                      <>
                        <button className='ghost' onClick={() => handleEditTemplate(tpl)}>编辑</button>
                        <button className='ghost danger' onClick={() => handleDeleteTemplate(tpl)}>删除</button>
                      </>
                    )}
                  </div>
                </div>
              )) : (
                <div className='panel-empty'>暂无模板</div>
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



