import { useEffect, useRef } from 'react'
import Editor, { type CanvasEditorBlock } from '@hufe921/canvas-editor'
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
  onExport: (format: 'pdf' | 'word' | 'html') => void
  onPrint: () => void
  onDeleteDoc: () => void
  onDeleteTemplate: () => void
  activeDoc: DocDetail | null
  activeTemplate: TemplateRow | null
  formatDate: (value: string) => string
  value: string
  onChange: (value: string) => void
  editorStyle: string
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
  editorStyle,
}: Props) => {
  const hasContent = viewMode === 'doc' ? !!activeDoc : !!activeTemplate
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const lastHtmlRef = useRef<string>('')

  const htmlToBlocks = (html: string): CanvasEditorBlock[] => {
    if (!html) return [{ value: '' }]
    return [{ value: html }]
  }

  useEffect(() => {
    if (!hasContent) return undefined
    const container = containerRef.current
    if (!container || editorRef.current) return undefined
    const initialBlocks = htmlToBlocks(value)
    editorRef.current = new Editor(container, {
      main: initialBlocks,
      placeholder: '直接输入内容，或使用模板快速创建文档',
      onChange: (_main, html) => {
        lastHtmlRef.current = html
        onChange(html)
      },
    })
    return () => {
      editorRef.current?.destroy()
      editorRef.current = null
    }
  }, [hasContent])

  useEffect(() => {
    const instance = editorRef.current
    if (!instance) return
    if (value === lastHtmlRef.current) return
    instance.setData(htmlToBlocks(value))
  }, [value])

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
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onSaveAsTemplate() }} disabled={!activeDoc}>
                        存为模板
                      </button>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onExport('pdf') }} disabled={!activeDoc}>
                        导出 PDF
                      </button>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onExport('word') }} disabled={!activeDoc}>
                        导出 Word
                      </button>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onExport('html') }} disabled={!activeDoc}>
                        导出 HTML
                      </button>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onPrint() }} disabled={!activeDoc}>
                        打印
                      </button>
                      <button className='menu-item danger' onClick={() => { onCloseEditorMenu(); onDeleteDoc() }} disabled={!activeDoc}>
                        删除
                      </button>
                    </>
                  ) : (
                    <>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onExport('pdf') }} disabled={!activeTemplate}>
                        导出 PDF
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
        ) : (
          <div className='editor-paper'>
            {editorStyle ? <style dangerouslySetInnerHTML={{ __html: editorStyle }} /> : null}
            <div className='canvas-editor' ref={containerRef} />
          </div>
        )}
      </div>
    </section>
  )
}

export default EditorPane
