import type { RefObject } from 'react'
import TreeView from '../../components/TreeView'
import type { FolderNode, TemplateEditorState, TemplateRow } from '../../types'

type Props = {
  panel: { folderId: number | null; mode: 'create' | 'manage' } | null
  onClosePanel: () => void
  templateSearch: string
  onSearchChange: (value: string) => void
  templateFolders: FolderNode[]
  activeTemplateFolderId: number | null
  onSelectTemplateFolder: (id: number | null) => void
  collapsedTemplateFolders: Set<number>
  onToggleTemplateFolder: (id: number) => void
  hoverFolderId: number | null
  setHoverFolderId: (value: number | null) => void
  templatePickId: number | null
  onPickTemplate: (id: number) => void
  templates: TemplateRow[]
  filteredTemplates: TemplateRow[]
  formatDate: (value: string) => string
  onCreateDocFromTemplateId: (id: number) => void
  onEditTemplate: (tpl: TemplateRow) => void
  onDeleteTemplate: () => void
  onOpenTemplateEditor: (mode: 'create' | 'edit', template?: TemplateRow) => void
  onImportTemplates: () => void
  onSaveAsTemplate: () => void
  canSaveAsTemplate: boolean
  editor: TemplateEditorState | null
  onCloseEditor: () => void
  onEditorNameChange: (value: string) => void
  editorRef: RefObject<HTMLDivElement>
  onEditorSave: () => void
}

const TemplatePanels = ({
  panel,
  onClosePanel,
  templateSearch,
  onSearchChange,
  templateFolders,
  activeTemplateFolderId,
  onSelectTemplateFolder,
  collapsedTemplateFolders,
  onToggleTemplateFolder,
  hoverFolderId,
  setHoverFolderId,
  templatePickId,
  onPickTemplate,
  templates,
  filteredTemplates,
  formatDate,
  onCreateDocFromTemplateId,
  onEditTemplate,
  onDeleteTemplate,
  onOpenTemplateEditor,
  onImportTemplates,
  onSaveAsTemplate,
  canSaveAsTemplate,
  editor,
  onCloseEditor,
  onEditorNameChange,
  editorRef,
  onEditorSave,
}: Props) => (
  <>
    {panel ? (
      <div className='panel-backdrop' onClick={onClosePanel}>
        <div className='panel' onClick={(event) => event.stopPropagation()}>
          <div className='panel-header'>
            <div className='panel-title'>我的模板</div>
            <button className='ghost' onClick={onClosePanel}>关闭</button>
          </div>
          <div className='panel-body'>
            <div className='panel-search'>
              <input
                placeholder='搜索模板名称'
                value={templateSearch}
                onChange={(event) => onSearchChange(event.target.value)}
              />
            </div>
            {panel.mode === 'create' ? (
              <div className='panel-template-select'>
                <div className='panel-tree'>
                  <TreeView
                    nodes={templateFolders}
                    rootLabel='全部模板'
                    rootActive={activeTemplateFolderId === null}
                    onRootClick={() => onSelectTemplateFolder(null)}
                    onRootContextMenu={(event) => event.preventDefault()}
                    selectedFolderId={activeTemplateFolderId}
                    collapsed={collapsedTemplateFolders}
                    onToggle={onToggleTemplateFolder}
                    onFolderMenu={() => {}}
                    hoverId={hoverFolderId}
                    setHoverId={setHoverFolderId}
                    onSelectDoc={(id) => onPickTemplate(id)}
                    activeDocId={templatePickId}
                    onDocMenu={() => {}}
                  />
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
                          onCreateDocFromTemplateId(templatePickId)
                          onClosePanel()
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
                      <button className='ghost' onClick={() => onEditTemplate(tpl)}>编辑</button>
                      <button className='ghost danger' onClick={onDeleteTemplate}>删除</button>
                    </div>
                  </div>
                )) : (
                  <div className='panel-empty'>暂无模板</div>
                )}
              </>
            )}
          </div>
          {panel.mode === 'manage' ? (
            <div className='panel-footer'>
              <button className='ghost' onClick={() => onOpenTemplateEditor('create')}>新增模板</button>
              <button className='ghost' onClick={onImportTemplates}>
                导入模板
              </button>
              <button className='primary' onClick={onSaveAsTemplate} disabled={!canSaveAsTemplate}>保存当前文档为模板</button>
            </div>
          ) : null}
        </div>
      </div>
    ) : null}

    {editor ? (
      <div className='panel-backdrop' onClick={onCloseEditor}>
        <div className='panel editor-panel' onClick={(event) => event.stopPropagation()}>
          <div className='panel-header'>
            <div className='panel-title'>{editor.mode === 'create' ? '新建模板' : '编辑模板'}</div>
            <button className='ghost' onClick={onCloseEditor}>关闭</button>
          </div>
          <div className='panel-body'>
            <label className='panel-field'>
              <span>模板名称</span>
              <input
                value={editor.name}
                onChange={(event) => onEditorNameChange(event.target.value)}
              />
            </label>
            <label className='panel-field'>
              <span>模板内容（支持富文本粘贴）</span>
              <div
                className='template-editor'
                contentEditable
                suppressContentEditableWarning
                ref={editorRef}
              />
            </label>
          </div>
          <div className='panel-footer'>
            <button className='ghost' onClick={onCloseEditor}>取消</button>
            <button className='primary' onClick={onEditorSave}>保存</button>
          </div>
        </div>
      </div>
    ) : null}
  </>
)

export default TemplatePanels
