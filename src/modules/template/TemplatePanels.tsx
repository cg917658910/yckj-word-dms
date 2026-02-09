import TreeView from '../../components/TreeView';
import type { DocSummary, FolderNode, TemplateEditorState, TemplateRow } from '../../types';

type Props = {
  panel: { folderId: number | null; mode: 'create' | 'manage' } | null
  onClosePanel: () => void
  templateSearch: string
  onSearchChange: (value: string) => void
  templateFolders: FolderNode[]
  rootTemplates: DocSummary[]
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
  editor: TemplateEditorState | null
  onCloseEditor: () => void
  onEditorNameChange: (value: string) => void
  onEditorContentChange: (value: string) => void
  onEditorSave: () => void
}

const TemplatePanels = ({
  panel,
  onClosePanel,
  templateSearch,
  onSearchChange,
  templateFolders,
  rootTemplates,
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
  editor,
  onCloseEditor,
  onEditorNameChange,
  onEditorContentChange,
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
                <div className='panel-tree-col'>
                  <div className='panel-tree-header'>选择模板</div>
                  <div className='panel-tree'>
                    <TreeView
                      nodes={templateFolders}
                      rootDocs={rootTemplates}
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
                </div>
                <div className='panel-preview-col'>
                  <div className='panel-preview-header'>
                    {templatePickId
                      ? templates.find((tpl) => tpl.id === templatePickId)?.name ?? '模板预览'
                      : '模板预览'}
                  </div>
                  <div className='panel-preview'>
                    {templatePickId ? (
                      <div
                        className='panel-preview-body'
                        dangerouslySetInnerHTML={{
                          __html: templates.find((tpl) => tpl.id === templatePickId)?.content ?? '',
                        }}
                      />
                    ) : (
                      <div className='panel-preview-placeholder'>
                        <div className='panel-preview-placeholder-icon'>📄</div>
                        <div className='panel-preview-placeholder-text'>请在左侧选择模板进行预览</div>
                      </div>
                    )}
                  </div>
                  {templatePickId && (
                    <div className='panel-preview-actions'>
                      <button
                        className='primary'
                        onClick={() => {
                          onCreateDocFromTemplateId(templatePickId)
                          onClosePanel()
                        }}
                      >
                        使用该模板创建文档
                      </button>
                    </div>
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
        </div>
      </div>
    ) : null}
  </>
)

export default TemplatePanels
