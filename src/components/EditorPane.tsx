import Editor, { ElementType, RowFlex, TitleLevel } from '@hufe921/canvas-editor'
import docxPlugin from '@hufe921/canvas-editor-plugin-docx'
import { useEffect, useMemo, useRef } from 'react'
import type { DocDetail, TemplateRow } from '../types'
import { parseEditorData, serializeEditorData } from '../utils/editor'

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
  onHtmlChange?: (value: string) => void
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
  onHtmlChange,
}: Props) => {
  const hasContent = viewMode === 'doc' ? !!activeDoc : !!activeTemplate
  const editorKey = viewMode === 'doc' ? activeDoc?.id ?? null : activeTemplate?.id ?? null
  const containerRef = useRef<HTMLDivElement | null>(null)
  const editorRef = useRef<Editor | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const lastValueRef = useRef<string>('')

  const getHtml = (instance: Editor) => {
    if (typeof instance.command.getHTML !== 'function') return ''
    const result = instance.command.getHTML()
    if (typeof result === 'string') return result
    if (result && typeof result === 'object') {
      return (result as { main?: string }).main ?? ''
    }
    return ''
  }

  const getValue = async (instance: Editor) => {
    if (typeof instance.command.getValueAsync === 'function') {
      return instance.command.getValueAsync()
    }
    if (typeof instance.command.getValue === 'function') {
      return instance.command.getValue()
    }
    return null
  }

  const scheduleSave = useMemo(
    () => () => {
      if (!editorRef.current) return
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current)
      }
      saveTimerRef.current = window.setTimeout(async () => {
        if (!editorRef.current) return
        const result = await getValue(editorRef.current)
        const data = result?.data ?? null
        if (data) {
          const nextValue = serializeEditorData(data)
          lastValueRef.current = nextValue
          onChange(nextValue)
        }
        if (onHtmlChange) {
          onHtmlChange(getHtml(editorRef.current))
        }
      }, 200)
    },
    [onChange, onHtmlChange]
  )

  const run = (fn: (command: Editor['command']) => void) => {
    if (!editorRef.current) return
    editorRef.current.command.executeFocus()
    fn(editorRef.current.command)
  }
  const exportDocx = (name: string) =>
    run((cmd) => (cmd as any).executeExportDocx({ fileName: name || '文档' }))

  const handleSelectTable = async () => {
    if (!editorRef.current) return
    const cmd = editorRef.current.command
    cmd.executeFocus()
    const range = (cmd as any).getRange?.()
    if (range?.tableId) {
      cmd.executeSetPositionContext(range)
      cmd.executeTableSelectAll()
      return
    }
    const result =
      (await (cmd as any).getValueAsync?.()) ||
      (typeof (cmd as any).getValue === 'function' ? (cmd as any).getValue() : null)
    const list = result?.data?.main ?? []
    const tableIndex = list.findIndex((item: any) => item?.type === ElementType.TABLE)
    if (tableIndex < 0) return
    const table = list[tableIndex]
    if (!table?.id || !table?.trList?.length || !table.trList[0]?.tdList?.length) return
    cmd.executeSetRange(tableIndex, tableIndex, table.id, 0, 0, 0, 0)
    cmd.executeSetPositionContext({ tableId: table.id, startTrIndex: 0, startTdIndex: 0 } as any)
    cmd.executeTableSelectAll()
  }

  useEffect(() => {
    if (!hasContent) {
      editorRef.current?.destroy()
      editorRef.current = null
      return undefined
    }
    const container = containerRef.current
    if (!container) return undefined

    editorRef.current?.destroy()
    const data = parseEditorData(value)
    const instance = new Editor(container, data as any, {
      // 页眉
      header: { disabled:true },
      // 页脚
      footer: { disabled:true },
    })
    instance.use(docxPlugin)
    //instance.use(floatingToolbarPlugin)
    const docxFileInput = document.querySelector<HTMLInputElement>('#file-docx');
    instance.register.contextMenuList([
      {
        name: "导入Word",
        when: (payload) => true,
        callback: (command) => {
          docxFileInput?.click();
        },
      },
      {
        name: "导出为PDF",
        when: (payload) => true,
        callback: (command) => {
          onExport('pdf') 
        },
      },
      {
        name: "导出为Word",
        when: (payload) => true,
        callback: (command) => {
          (command as any).executeExportDocx({
            fileName: titleDraft || '文档',
          });
        },
      },
    ])
    if (docxFileInput) {
    docxFileInput.onchange = () => {
      const file = docxFileInput?.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
          const buffer = event?.target?.result;
          if (buffer instanceof ArrayBuffer) {
            (instance.command as any).executeImportDocx({
              arrayBuffer: buffer,
            });
          }
          docxFileInput.value = "";
        };
      reader.readAsArrayBuffer(file);
    };
  }
    editorRef.current = instance
    lastValueRef.current = value

    const handleChange = scheduleSave
    if ((instance as { listener?: { contentChange?: () => void } }).listener) {
      ;(instance as { listener: { contentChange?: () => void } }).listener.contentChange = handleChange
    }
    instance.eventBus.on('contentChange', handleChange)

    if (onHtmlChange) {
      onHtmlChange(getHtml(instance))
    }

    return () => {
      instance.eventBus.off?.('contentChange', handleChange)
      instance.destroy()
      if (editorRef.current === instance) {
        editorRef.current = null
      }
    }
  }, [editorKey, hasContent])

  useEffect(() => {
    if (!hasContent) return
    if (!editorRef.current) return
    if (value === lastValueRef.current) return
    const data = parseEditorData(value)
    editorRef.current.command.executeSetValue(data as any)
    lastValueRef.current = value
    if (onHtmlChange) {
      onHtmlChange(getHtml(editorRef.current))
    }
  }, [value, hasContent])

  // value changes are driven by editor events, avoid re-initializing on every update

  return (
    <section className='editor'>
      <div className='editor-toolbar'>
        <div className='editor-format'>
          <button className='tool' onClick={() => run((cmd) => cmd.executeUndo())} title='撤销'>
            ↶
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRedo())} title='重做'>
            ↷
          </button>
          <span className='tool-divider' />
          <select
            className='tool-select'
            defaultValue='paragraph'
            onChange={(event) => {
              const value = event.target.value
              if (value === 'paragraph') {
                run((cmd) => cmd.executeTitle(null))
                return
              }
              const level = Number(value) as unknown as TitleLevel
              run((cmd) => cmd.executeTitle(level))
            }}
          >
            <option value='paragraph'>正文</option>
            <option value={TitleLevel.FIRST}>标题 1</option>
            <option value={TitleLevel.SECOND}>标题 2</option>
            <option value={TitleLevel.THIRD}>标题 3</option>
          </select>
          <select
            className='tool-select'
            defaultValue='14'
            onChange={(event) => {
              const size = Number(event.target.value)
              if (!Number.isNaN(size)) run((cmd) => cmd.executeSize(size))
            }}
          >
            {[12, 14, 16, 18, 20, 22, 24, 28, 32].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <select
            className='tool-select'
            defaultValue='1.5'
            onChange={(event) => {
              const value = Number(event.target.value)
              if (!Number.isNaN(value)) run((cmd) => cmd.executeRowMargin(value))
            }}
          >
            <option value='1'>1.0</option>
            <option value='1.2'>1.2</option>
            <option value='1.5'>1.5</option>
            <option value='1.75'>1.75</option>
            <option value='2'>2.0</option>
            <option value='2.5'>2.5</option>
          </select>
          <span className='tool-divider' />
          <button className='tool' onClick={() => run((cmd) => cmd.executeBold())} title='加粗'>
            B
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeItalic())} title='斜体'>
            I
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeUnderline())} title='下划线'>
            U
          </button>
          <span className='tool-divider' />
          <button
            className='tool'
            onClick={() =>
              run((cmd) =>
                cmd.executeInsertElementList([{ type: ElementType.TAB, value: '' }])
              )
            }
            title='缩进'
          >
            ↦
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeBackspace())} title='退格'>
            ↤
          </button>
          <span className='tool-divider' />
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.LEFT))} title='左对齐'>
            L
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.CENTER))} title='居中'>
            C
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.RIGHT))} title='右对齐'>
            R
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.JUSTIFY))} title='两端对齐'>
            J
          </button>
          <span className='tool-divider' />
          <button className='tool' onClick={() => run((cmd) => cmd.executeInsertTable(3, 3))} title='插入表格'>
            表格
          </button>
          <button className='tool' onClick={() => void handleSelectTable()} title='选中表格'>
            选表
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executePrint())} title='打印'>
            打印
          </button>
        </div>
       {/*  <div className='editor-title-bar'>
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
                      <button
                        className='menu-item'
                        onClick={() => {
                          onCloseEditorMenu()
                          if (activeDoc) exportDocx(activeDoc.title)
                        }}
                        disabled={!activeDoc}
                      >
                        导出 Word
                      </button>
                      <button className='menu-item' onClick={() => { onCloseEditorMenu(); onExport('html') }} disabled={!activeDoc}>
                        导出 HTML
                      </button>
                      <button
                        className='menu-item'
                        onClick={() => {
                          onCloseEditorMenu()
                          run((cmd) => cmd.executePrint())
                        }}
                        disabled={!activeDoc}
                      >
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
        </div> */}
      </div>

      <div className='editor-canvas'>
        {!hasContent ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p style={{ color: '#94a3b8', fontSize: 15 }}>选择或创建文档开始编辑</p>
          </div>
        ) : (
          <div /* className='editor-paper' */>
            <div className='canvas-editor' ref={containerRef} />
            <input type="file" name="file-docx" style={{ display: 'none' }} id="file-docx" accept=".docx" />
          </div>
        )}
      </div>
    </section>
  )
}

export default EditorPane
