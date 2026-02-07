import ClassicEditor from '@ckeditor/ckeditor5-build-classic'
import '@ckeditor/ckeditor5-build-classic/build/translations/zh-cn'
import { CKEditor } from '@ckeditor/ckeditor5-react'
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
  onSaveAsTemplate: () => void
  onExport: (format: 'pdf' | 'word') => void
  onPrint: () => void
  onDeleteDoc: () => void
  onDeleteTemplate: () => void
  activeDoc: DocDetail | null
  activeTemplate: TemplateRow | null
  formatDate: (value: string) => string
  value: string
  onChange: (value: string) => void
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
  onSaveAsTemplate,
  onExport,
  onPrint,
  onDeleteDoc,
  onDeleteTemplate,
  activeDoc,
  activeTemplate,
  formatDate,
  value,
  onChange,
}: Props) => (
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
                    <button className='menu-item' onClick={() => { onCloseEditorMenu(); onSaveAsTemplate() }} disabled={!activeDoc}>
                      设为模板
                    </button>
                    <button className='menu-item' onClick={() => { onCloseEditorMenu(); onExport('pdf') }} disabled={!activeDoc}>
                      导出 PDF
                    </button>
                    <button className='menu-item' onClick={() => { onCloseEditorMenu(); onExport('word') }} disabled={!activeDoc}>
                      导出 Word
                    </button>
                    <button className='menu-item' onClick={() => { onCloseEditorMenu(); onPrint() }} disabled={!activeDoc}>
                      打印
                    </button>
                    <button className='menu-item danger' onClick={() => { onCloseEditorMenu(); onDeleteDoc() }} disabled={!activeDoc}>
                      删除
                    </button>
                  </>
                ) : (
                  <button className='menu-item danger' onClick={() => { onCloseEditorMenu(); onDeleteTemplate() }} disabled={!activeTemplate}>
                    删除模板
                  </button>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>

   {/*  <div className='editor-meta'>
      <div className='doc-badge'>文档</div>
      <div className='doc-info'>
        更新时间：{activeDoc ? formatDate(activeDoc.updatedAt) : '--'} · 创建时间：{activeDoc ? formatDate(activeDoc.createdAt) : '--'}
      </div>
    </div> */}

    <div className='editor-canvas'>
      <div className='editor-paper'>
        <CKEditor
          editor={ClassicEditor as unknown as any}
          data={value}
          onChange={(_, editor) => onChange(editor.getData())}
          config={
            {
              language: 'zh-cn',
              placeholder: '直接输入内容，或使用模板快速创建文档',
              htmlSupport: {
                allow: [
                  {
                    name: /.*/,
                    attributes: true,
                    classes: true,
                    styles: true,
                  },
                ],
              },
              toolbar: [
                'undo',
                'redo',
                '|',
                'heading',
                '|',
                'bold',
                'italic',
                'underline',
                '|',
                'bulletedList',
                'numberedList',
                'blockQuote',
                'link',
              ],
            } as any
          }
        />
      </div>
    </div>
  </section>
)

export default EditorPane

