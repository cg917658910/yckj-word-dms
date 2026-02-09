import type { DocDetail, TemplateRow } from '../types'

type Props = {
  viewMode: 'doc' | 'template'
  titleDraft: string
  onTitleChange: (value: string) => void
  onTitleBlur: () => void
  canEditTitle: boolean
  editorMenuOpen: boolean
  onToggleEditorMenu: () => void
  onCloseEditorMenu: () => void
  onDeleteDoc: () => void
  onDeleteTemplate: () => void
  onOpenDoc: () => void
  onRevealDoc: () => void
  onOpenTemplate: () => void
  onRevealTemplate: () => void
  activeDoc: DocDetail | null
  activeTemplate: TemplateRow | null
  formatDate: (value: string) => string
}

const EditorPane = ({
  viewMode,
  titleDraft,
  onTitleChange,
  onTitleBlur,
  canEditTitle,
  editorMenuOpen,
  onToggleEditorMenu,
  onCloseEditorMenu,
  onDeleteDoc,
  onDeleteTemplate,
  onOpenDoc,
  onRevealDoc,
  onOpenTemplate,
  onRevealTemplate,
  activeDoc,
  activeTemplate,
  formatDate,
}: Props) => {
  const hasContent = viewMode === 'doc' ? !!activeDoc : !!activeTemplate

  return (
    <section className='editor'>
      <div className='editor-toolbar'>
        <div className='editor-title-bar'>
          <div className='editor-title-left'>
            <input
              className='doc-title-input'
              value={titleDraft}
              onChange={(event) => onTitleChange(event.target.value)}
              onBlur={onTitleBlur}
              placeholder='请输入标题'
              disabled={!canEditTitle}
            />
          </div>
          <div className='editor-title-right'>
            <div className='editor-menu-wrap'>
              <button className='tool' onClick={onToggleEditorMenu}>···</button>
              {editorMenuOpen ? (
                <div className='menu editor-menu'>
                  {viewMode === 'doc' ? (
                    <>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onOpenDoc() }} disabled={!activeDoc}>
                        使用本地 Word/WPS 打开
                      </button>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onRevealDoc() }} disabled={!activeDoc}>
                        在文件夹中显示
                      </button>
                      <button className='menu-item danger' onClick={() => { onCloseEditorMenu(); onDeleteDoc() }} disabled={!activeDoc}>
                        删除
                      </button>
                    </>
                  ) : (
                    <>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onOpenTemplate() }} disabled={!activeTemplate}>
                        使用本地 Word/WPS 打开
                      </button>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onRevealTemplate() }} disabled={!activeTemplate}>
                        在文件夹中显示
                      </button>
                      <button className='menu-item danger' onClick={() => { onCloseEditorMenu(); onDeleteTemplate() }} disabled={!activeTemplate}>
                        删除模板
                      </button>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className='editor-canvas'>
        {!hasContent ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p style={{ color: '#94a3b8', fontSize: 15 }}>选择或创建文档开始编辑</p>
          </div>
        ) : viewMode === 'doc' ? (
          <div className='editor-paper doc-file-panel'>
            <div className='doc-file-card'>
              <div className='doc-file-title'>{activeDoc?.title ?? '未命名文档'}</div>
              <div className='doc-file-meta'>
                <div>
                  <span>最近更新：</span>
                  <span>{activeDoc ? formatDate(activeDoc.updatedAt) : '-'}</span>
                </div>
                <div>
                  <span>文件大小：</span>
                  <span>{activeDoc ? `${(activeDoc.size / 1024).toFixed(1)} KB` : '-'}</span>
                </div>
                <div className='doc-file-path'>
                  <span>文件路径：</span>
                  <span>{activeDoc?.filePath ?? '未关联文件'}</span>
                </div>
              </div>
              <div className='doc-file-actions'>
                <button className='primary' onClick={onOpenDoc} disabled={!activeDoc}>
                  使用本地 Word/WPS 编辑
                </button>
                <button onClick={onRevealDoc} disabled={!activeDoc}>
                  在文件夹中显示
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className='editor-paper doc-file-panel'>
            <div className='doc-file-card'>
              <div className='doc-file-title'>{activeTemplate?.name ?? '未命名模板'}</div>
              <div className='doc-file-meta'>
                <div>
                  <span>最近更新：</span>
                  <span>{activeTemplate ? formatDate(activeTemplate.updatedAt) : '-'}</span>
                </div>
                <div>
                  <span>文件大小：</span>
                  <span>{activeTemplate ? `${((activeTemplate.size ?? 0) / 1024).toFixed(1)} KB` : '-'}</span>
                </div>
                <div className='doc-file-path'>
                  <span>文件路径：</span>
                  <span>{activeTemplate?.filePath ?? '未关联文件'}</span>
                </div>
              </div>
              <div className='doc-file-actions'>
                <button className='primary' onClick={onOpenTemplate} disabled={!activeTemplate}>
                  使用本地 Word/WPS 编辑
                </button>
                <button onClick={onRevealTemplate} disabled={!activeTemplate}>
                  在文件夹中显示
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

export default EditorPane
