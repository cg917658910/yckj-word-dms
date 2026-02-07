import { useEffect, useState } from 'react'
import './App.css'
import EditorPane from './components/EditorPane'
import { useDocuments } from './hooks/useDocuments'
import { useEditor } from './hooks/useEditor'
import { useTemplates } from './hooks/useTemplates'
import DocFolderMenu from './modules/doc/DocFolderMenu'
import DocMenu from './modules/doc/DocMenu'
import DocSidebar from './modules/doc/DocSidebar'
import FindReplacePanel from './modules/doc/FindReplacePanel'
import TemplateFolderMenu from './modules/template/TemplateFolderMenu'
import TemplateMenu from './modules/template/TemplateMenu'
import TemplatePanels from './modules/template/TemplatePanels'
import TemplateSidebar from './modules/template/TemplateSidebar'
import type { DialogState, MenuState } from './types'
import { stripHtml, toDocSummary } from './utils/tree'

function formatDate(value: string) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}


function App() {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [dialogValue, setDialogValue] = useState('')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [menuSubOpen, setMenuSubOpen] = useState(false)
  const [hoverFolderId, setHoverFolderId] = useState<number | null>(null)
  const [titleDraft, setTitleDraft] = useState('')
  const [editorMenuOpen, setEditorMenuOpen] = useState(false)
  const [findReplaceOpen, setFindReplaceOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'doc' | 'template'>('doc')

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

  const {
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
    handleRenameDoc,
    handleDeleteDoc,
    handleCopyDoc,
    highlight,
    handleDocMenuRename,
    handleDocMenuCopy,
    handleDocMenuDelete,
  } = useDocuments({ openDialog })

  const {
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
    templateEditorRef,
    filteredTemplates,
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
    handleImportTemplates,
    handleUploadTemplateFiles,
    handleUploadTemplateFolder,
    handleMenuCreateFromTemplate,
    handleTemplateMenuRename,
    handleTemplateMenuCopy,
    handleTemplateMenuDelete,
    } = useTemplates({ openDialog })

  useEffect(() => {
    const boot = async () => {
      await window.api.db.init()
      await refreshFolders(undefined, false)
      await refreshTemplateFolders(undefined, false)
      await refreshDocs(null)
    }
    boot()
  }, [])

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

  const {
    editorRef,
    lineHeight,
    setLineHeight,
    applyCommand,
    applyWithSelection,
    applyBlockStyle,
    adjustIndent,
    handleEditorKeyDown,
    onSelectMouseDown,
    onEditorMouseDown,
    onEditorMouseUp,
    onEditorKeyUp,
    onEditorBlur,
  } = useEditor({ onSave: handleSave })

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

  const handleCreateDocFromTemplateId = async (templateId: number) => {
    const tpl = templates.find((item) => item.id === templateId)
    if (!tpl) return
    const detail = await handleMenuCreateFromTemplate(templatePanel?.folderId ?? null, tpl)
    if (!detail) return
    const nextDocs = [toDocSummary(detail), ...docs]
    syncTreeWithDocs(nextDocs)
    setActiveDoc(detail)
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

  const handleFolderMenuClose = () => {
    setMenu(null)
    setMenuSubOpen(false)
  }

  const handleDocMenuRenameFolder = () => {
    handleFolderMenuClose()
    handleRenameFolder()
  }

  const handleDocMenuDeleteFolder = () => {
    handleFolderMenuClose()
    handleDeleteFolder()
  }

  const handleDocMenuCreateBlank = () => {
    handleFolderMenuClose()
    const targetFolderId = menu?.folderId === 0 ? activeFolderId : menu?.folderId
    if (typeof targetFolderId === 'number') handleMenuCreateDoc(targetFolderId)
  }

  const handleDocMenuCreateFromTemplate = () => {
    handleFolderMenuClose()
    handleOpenTemplatePanel(menu?.folderId === 0 ? activeFolderId : (menu?.folderId ?? null), 'create')
  }

  const handleDocMenuCreateFolder = () => {
    handleFolderMenuClose()
    handleCreateFolder()
  }

  const handleTemplateMenuRenameFolder = () => {
    handleFolderMenuClose()
    handleRenameTemplateFolder()
  }

  const handleTemplateMenuDeleteFolder = () => {
    handleFolderMenuClose()
    handleDeleteTemplateFolder()
  }

  const handleTemplateMenuUploadFiles = async () => {
    const targetFolderId = menu?.folderId === 0 ? activeTemplateFolderId : menu?.folderId
    handleFolderMenuClose()
    await handleUploadTemplateFiles(typeof targetFolderId === 'number' ? targetFolderId : null)
  }

  const handleTemplateMenuUploadFolder = async () => {
    const targetFolderId = menu?.folderId === 0 ? activeTemplateFolderId : menu?.folderId
    handleFolderMenuClose()
    await handleUploadTemplateFolder(typeof targetFolderId === 'number' ? targetFolderId : null)
  }

  const handleTemplateMenuCreateBlank = () => {
    handleFolderMenuClose()
    const targetFolderId = menu?.folderId === 0 ? activeTemplateFolderId : menu?.folderId
    handleCreateTemplate(typeof targetFolderId === 'number' ? targetFolderId : null)
  }

  const handleTemplateMenuCreateFolder = () => {
    handleFolderMenuClose()
    handleCreateTemplateFolder()
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
            {viewMode === 'doc' ? (
              <DocSidebar
                nodes={folders}
                rootActive={activeFolderId === null}
                selectedFolderId={activeFolderId}
                collapsed={collapsedFolders}
                hoverId={hoverFolderId}
                setHoverId={setHoverFolderId}
                activeDocId={activeDoc?.id ?? null}
                onRootClick={() => handleSelectFolder(null)}
                onRootContextMenu={(event) => {
                  event.preventDefault()
                  setMenu({ folderId: 0, x: event.clientX, y: event.clientY })
                  setMenuSubOpen(false)
                }}
                onToggleFolder={handleToggleFolder}
                onFolderMenu={(id, x, y) => {
                  setActiveFolderId(id)
                  setMenu({ folderId: id, x, y })
                  setMenuSubOpen(false)
                }}
                onSelectDoc={handleSelectDoc}
                onDocMenu={setDocMenu}
              />
            ) : (
              <TemplateSidebar
                nodes={templateFolders}
                rootActive={activeTemplateFolderId === null}
                selectedFolderId={activeTemplateFolderId}
                collapsed={collapsedTemplateFolders}
                hoverId={hoverFolderId}
                setHoverId={setHoverFolderId}
                activeTemplateId={activeTemplate?.id ?? null}
                onRootClick={() => handleSelectTemplateFolder(null)}
                onRootContextMenu={(event) => {
                  event.preventDefault()
                  setMenu({ folderId: 0, x: event.clientX, y: event.clientY })
                  setMenuSubOpen(false)
                }}
                onToggleFolder={handleToggleTemplateFolder}
                onFolderMenu={(id, x, y) => {
                  setActiveTemplateFolderId(id)
                  setMenu({ folderId: id, x, y })
                  setMenuSubOpen(false)
                }}
                onSelectTemplate={handleSelectTemplate}
                onTemplateMenu={setTemplateMenu}
              />
            )}
          </div>
        </div>
      </aside>

      <EditorPane
        viewMode={viewMode}
        titleDraft={titleDraft}
        onTitleChange={setTitleDraft}
        onTitleBlur={handleTitleBlur}
        canEditTitle={viewMode === 'doc' ? !!activeDoc : !!activeTemplate}
        editorMenuOpen={editorMenuOpen}
        onToggleEditorMenu={() => setEditorMenuOpen((prev) => !prev)}
        onCloseEditorMenu={() => setEditorMenuOpen(false)}
        onSaveAsTemplate={handleSaveAsTemplate}
        onExport={(format) => handleExport(format)}
        onPrint={handlePrint}
        onDeleteDoc={handleDeleteDoc}
        onDeleteTemplate={handleDeleteTemplate}
        activeDoc={activeDoc}
        activeTemplate={activeTemplate}
        formatDate={formatDate}
        applyCommand={applyCommand}
        applyWithSelection={applyWithSelection}
        applyBlockStyle={applyBlockStyle}
        adjustIndent={adjustIndent}
        lineHeight={lineHeight}
        onLineHeightChange={setLineHeight}
        onSelectMouseDown={onSelectMouseDown}
        editorRef={editorRef}
        onEditorKeyDown={handleEditorKeyDown}
        onEditorKeyUp={onEditorKeyUp}
        onEditorMouseUp={onEditorMouseUp}
        onEditorMouseDown={onEditorMouseDown}
        onEditorBlur={onEditorBlur}
      />

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

      {viewMode === 'doc' ? (
        <DocFolderMenu
          menu={menu}
          submenuOpen={menuSubOpen}
          onSubmenuOpen={setMenuSubOpen}
          onClose={handleFolderMenuClose}
          onRename={handleDocMenuRenameFolder}
          onDelete={handleDocMenuDeleteFolder}
          onCreateBlank={handleDocMenuCreateBlank}
          onCreateFromTemplate={handleDocMenuCreateFromTemplate}
          onCreateFolder={handleDocMenuCreateFolder}
          disableActions={menu?.folderId === 0}
        />
      ) : (
        <TemplateFolderMenu
          menu={menu}
          submenuOpen={menuSubOpen}
          onSubmenuOpen={setMenuSubOpen}
          onClose={handleFolderMenuClose}
          onRename={handleTemplateMenuRenameFolder}
          onDelete={handleTemplateMenuDeleteFolder}
          onUploadFiles={handleTemplateMenuUploadFiles}
          onUploadFolder={handleTemplateMenuUploadFolder}
          onCreateBlank={handleTemplateMenuCreateBlank}
          onCreateFolder={handleTemplateMenuCreateFolder}
          disableActions={menu?.folderId === 0}
        />
      )}

      <DocMenu
        menu={docMenu}
        onClose={() => setDocMenu(null)}
        onRename={handleDocMenuRename}
        onCopy={handleDocMenuCopy}
        onDelete={handleDocMenuDelete}
      />

      <TemplateMenu
        menu={templateMenu}
        onClose={() => setTemplateMenu(null)}
        onRename={handleTemplateMenuRename}
        onCopy={handleTemplateMenuCopy}
        onDelete={handleTemplateMenuDelete}
      />

      <TemplatePanels
        panel={templatePanel}
        onClosePanel={() => setTemplatePanel(null)}
        templateSearch={templateSearch}
        onSearchChange={setTemplateSearch}
        templateFolders={templateFolders}
        activeTemplateFolderId={activeTemplateFolderId}
        onSelectTemplateFolder={handleSelectTemplateFolder}
        collapsedTemplateFolders={collapsedTemplateFolders}
        onToggleTemplateFolder={handleToggleTemplateFolder}
        hoverFolderId={hoverFolderId}
        setHoverFolderId={setHoverFolderId}
        templatePickId={templatePickId}
        onPickTemplate={setTemplatePickId}
        templates={templates}
        filteredTemplates={filteredTemplates}
        formatDate={formatDate}
        onCreateDocFromTemplateId={(id) => {
          handleCreateDocFromTemplateId(id)
          setTemplatePickId(null)
        }}
        onEditTemplate={handleEditTemplate}
        onDeleteTemplate={handleDeleteTemplate}
        onOpenTemplateEditor={handleOpenTemplateEditor}
        onImportTemplates={handleImportTemplates}
        onSaveAsTemplate={handleSaveAsTemplate}
        canSaveAsTemplate={!!activeDoc}
        editor={templateEditor}
        onCloseEditor={() => setTemplateEditor(null)}
        onEditorNameChange={(value) => {
          if (!templateEditor) return
          setTemplateEditor({ ...templateEditor, name: value })
        }}
        editorRef={templateEditorRef}
        onEditorSave={handleTemplateEditorSave}
      />

      <FindReplacePanel
        open={findReplaceOpen}
        onClose={() => setFindReplaceOpen(false)}
        findQuery={findQuery}
        replaceQuery={replaceQuery}
        setFindQuery={setFindQuery}
        setReplaceQuery={setReplaceQuery}
        findCommitQuery={findCommitQuery}
        setFindCommitQuery={setFindCommitQuery}
        matchedDocs={matchedDocs}
        highlight={highlight}
        onExecute={async () => {
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
      />
    </div>
  )
}

export default App


















