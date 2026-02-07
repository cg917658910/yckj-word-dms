import type { RefObject } from 'react'
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
  applyCommand: (command: string, value?: string) => void
  applyWithSelection: (fn: () => void) => void
  applyBlockStyle: (style: 'textAlign' | 'lineHeight', value: string) => void
  adjustIndent: (delta: number) => void
  lineHeight: string
  onLineHeightChange: (value: string) => void
  onSelectMouseDown: () => void
  editorRef: RefObject<HTMLDivElement>
  onEditorKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onEditorKeyUp: () => void
  onEditorMouseUp: () => void
  onEditorMouseDown: () => void
  onEditorBlur: () => void
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
  applyCommand,
  applyWithSelection,
  applyBlockStyle,
  adjustIndent,
  lineHeight,
  onLineHeightChange,
  onSelectMouseDown,
  editorRef,
  onEditorKeyDown,
  onEditorKeyUp,
  onEditorMouseUp,
  onEditorMouseDown,
  onEditorBlur,
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
            <button className='tool' onClick={onToggleEditorMenu}>•••</button>
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

    <div className='editor-format'>
      <button className='tool icon' onClick={() => applyCommand('undo')}>↶</button>
      <button className='tool icon' onClick={() => applyCommand('redo')}>↷</button>
      <select
        className='tool-select'
        onMouseDown={onSelectMouseDown}
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
        onMouseDown={onSelectMouseDown}
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
        onMouseDown={onSelectMouseDown}
        onChange={(event) => {
          onLineHeightChange(event.target.value)
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
        onKeyDown={onEditorKeyDown}
        onKeyUp={onEditorKeyUp}
        onMouseUp={onEditorMouseUp}
        onMouseDown={onEditorMouseDown}
        onBlur={onEditorBlur}
      />
    </div>
  </section>
)

export default EditorPane
