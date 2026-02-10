import Editor, { ElementType, RowFlex, TitleLevel } from '@hufe921/canvas-editor'
import docxPlugin from '@hufe921/canvas-editor-plugin-docx'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const saveTimerRef = useRef<number | null>(null)
  const lastValueRef = useRef<string>('')
  const scrollLockRef = useRef(false)
  const lastScrollRef = useRef({ top: 0, left: 0 })
  const preInputScrollRef = useRef<{ top: number; left: number; pageNo: number | null } | null>(null)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 })
  const savedRangeRef = useRef<any | null>(null)

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

  const run = (
    fn: (command: Editor['command']) => void,
    options: { preserveSelection?: boolean; ensureFocus?: boolean; range?: any } = {}
  ) => {
    if (!editorRef.current) return
    const cmd = editorRef.current.command
    let preserve = options.preserveSelection !== false
    let range = preserve ? options.range ?? savedRangeRef.current ?? (cmd as any).getRange?.() : null
    if (range && (range.startIndex == null || range.endIndex == null || range.startIndex < 0 || range.endIndex < 0)) {
      range = null
    }
    if (options.ensureFocus && !range) {
      cmd.executeFocus()
      range = preserve ? (cmd as any).getRange?.() : null
    }
    if (preserve && !range) {
      preserve = false
    }
    try {
      if (range) {
        cmd.executeSetRange(
          range.startIndex,
          range.endIndex,
          range.tableId,
          range.startTdIndex,
          range.endTdIndex,
          range.startTrIndex,
          range.endTrIndex
        )
      }
      fn(cmd)
    } catch (error) {
      console.error(error)
    } finally {
      if (preserve && range) {
        cmd.executeSetRange(
          range.startIndex,
          range.endIndex,
          range.tableId,
          range.startTdIndex,
          range.endTdIndex,
          range.startTrIndex,
          range.endTrIndex
        )
        if (range.tableId) {
          cmd.executeSetPositionContext(range)
        }
      }
      const target = scrollRef.current
      const snapshot = preInputScrollRef.current
      if (target && snapshot) {
        const ctx = (cmd as any).getRangeContext?.()
        const currentPage = typeof ctx?.startPageNo === 'number' ? ctx.startPageNo : null
        if (currentPage === snapshot.pageNo) {
          scrollLockRef.current = true
          lastScrollRef.current = { top: snapshot.top, left: snapshot.left }
          target.scrollTop = snapshot.top
          target.scrollLeft = snapshot.left
          requestAnimationFrame(() => {
            if (!scrollRef.current) return
            scrollRef.current.scrollTop = lastScrollRef.current.top
            scrollRef.current.scrollLeft = lastScrollRef.current.left
            window.setTimeout(() => {
              scrollLockRef.current = false
            }, 120)
          })
        }
        preInputScrollRef.current = null
      }
    }
  }
  const exportDocx = (name: string) =>
    run((cmd) => (cmd as any).executeExportDocx({ fileName: name || '鏂囨。' }))


  const preserveScroll = () => {
    const target = scrollRef.current
    if (!target) return
    scrollLockRef.current = true
    lastScrollRef.current = { top: target.scrollTop, left: target.scrollLeft }
    requestAnimationFrame(() => {
      if (!scrollRef.current) return
      scrollRef.current.scrollTop = lastScrollRef.current.top
      scrollRef.current.scrollLeft = lastScrollRef.current.left
      window.setTimeout(() => {
        scrollLockRef.current = false
      }, 120)
    })
  }

  const captureRange = () => {
    if (!editorRef.current) return
    const cmd = editorRef.current.command
    const range = (cmd as any).getRange?.()
    if (range) savedRangeRef.current = range
  }

  const handleToolbarMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const container = scrollRef.current
    if (container && editorRef.current) {
      const ctx = (editorRef.current.command as any).getRangeContext?.()
      preInputScrollRef.current = {
        top: container.scrollTop,
        left: container.scrollLeft,
        pageNo: typeof ctx?.startPageNo === 'number' ? ctx.startPageNo : null,
      }
      preserveScroll()
    }
    if (target.closest('button')) {
      captureRange()
      event.preventDefault()
      return
    }
    if (target.closest('select')) {
      captureRange()
    }
  }

  const handleScroll = () => {
    const target = scrollRef.current
    if (!target) return
    if (scrollLockRef.current) {
      target.scrollTop = lastScrollRef.current.top
      target.scrollLeft = lastScrollRef.current.left
      return
    }
    lastScrollRef.current = { top: target.scrollTop, left: target.scrollLeft }
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
      header: { disabled:true },
      footer: { disabled:true },
      scrollContainerSelector: '.editor-canvas',
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
    savedRangeRef.current = null
    lastValueRef.current = value

    const handleChange = () => {
      const target = scrollRef.current
      if (target && preInputScrollRef.current) {
        const ctx = (instance.command as any).getRangeContext?.()
        const currentPage = typeof ctx?.startPageNo === 'number' ? ctx.startPageNo : null
        const { top, left, pageNo } = preInputScrollRef.current
        if (currentPage === pageNo) {
          target.scrollTop = top
          target.scrollLeft = left
        }
        preInputScrollRef.current = null
      }
      scheduleSave()
    }
    const handlePositionChange = () => {
      captureRange()
    }
    if ((instance as { listener?: { contentChange?: () => void } }).listener) {
      ;(instance as { listener: { contentChange?: () => void } }).listener.contentChange = handleChange
    }
    instance.eventBus.on('contentChange', handleChange)
    instance.eventBus.on('positionContextChange', handlePositionChange)

    if (onHtmlChange) {
      onHtmlChange(getHtml(instance))
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const container = scrollRef.current
      if (!container) return
      const active = document.activeElement
      if (active && !container.contains(active)) return
      const ctx = (instance.command as any).getRangeContext?.()
      preInputScrollRef.current = {
        top: container.scrollTop,
        left: container.scrollLeft,
        pageNo: typeof ctx?.startPageNo === 'number' ? ctx.startPageNo : null,
      }
    }
    window.addEventListener('keydown', handleKeydown, true)

    return () => {
      instance.eventBus.off?.('contentChange', handleChange)
      instance.eventBus.off?.('positionContextChange', handlePositionChange)
      window.removeEventListener('keydown', handleKeydown, true)
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
        <div className='editor-format' onMouseDown={handleToolbarMouseDown}>
          <button className='tool' onClick={() => run((cmd) => cmd.executeUndo())} title='撤销'>
            Undo
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRedo())} title='重做'>
            Redo
          </button>
          <span className='tool-divider' />
          <select
            className='tool-select'
            defaultValue='paragraph'
            onChange={(event) => {
              const value = event.target.value
              if (value === 'paragraph') {
                run((cmd) => cmd.executeTitle(null), { range: savedRangeRef.current })
                return
              }
              const level = value as TitleLevel
              run((cmd) => cmd.executeTitle(level), { range: savedRangeRef.current })
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
              if (!Number.isNaN(size)) run((cmd) => cmd.executeSize(size), { range: savedRangeRef.current })
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
              if (!Number.isNaN(value)) run((cmd) => cmd.executeRowMargin(value), { range: savedRangeRef.current })
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
          <button className='tool' onClick={() => run((cmd) => cmd.executeBold(), { range: savedRangeRef.current })} title='加粗'>
            B
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeItalic(), { range: savedRangeRef.current })} title='斜体'>
            I
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeUnderline(), { range: savedRangeRef.current })} title='下划线'>
            U
          </button>
          <span className='tool-divider' />
          <button
            className='tool'
            onClick={() =>
              run(
                (cmd) => cmd.executeInsertElementList([{ type: ElementType.TAB, value: '' }]),
                { range: savedRangeRef.current }
              )
            }
            title='缩进'
          >
            IN          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeBackspace(), { range: savedRangeRef.current })} title='退格'>
            OUT
          </button>
          <span className='tool-divider' />
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.LEFT), { range: savedRangeRef.current })} title='左对齐'>
            L
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.CENTER), { range: savedRangeRef.current })} title='居中'>
            C
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.RIGHT), { range: savedRangeRef.current })} title='右对齐'>
            R
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRowFlex(RowFlex.JUSTIFY), { range: savedRangeRef.current })} title='两端对齐'>
            J
          </button>
          <span className='tool-divider' />
          <button className='tool' onClick={() => { captureRange(); setTablePickerOpen(true) }} title='插入表格'>
            表格
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executePrint(), { preserveSelection: false, ensureFocus: true })} title='打印'>
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
                          run((cmd) => cmd.executePrint(), { preserveSelection: false, ensureFocus: true })
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

      {tablePickerOpen ? (
        <div className='table-picker-backdrop' onClick={() => setTablePickerOpen(false)}>
          <div className='table-picker' onClick={(event) => event.stopPropagation()}>
            <div className='table-picker-title'>插入表格</div>
            <div className='table-picker-grid'>
              {Array.from({ length: 10 }).map((_, row) => (
                <div key={`row-${row}`} className='table-picker-row'>
                  {Array.from({ length: 10 }).map((_, col) => {
                    const rows = row + 1
                    const cols = col + 1
                    const active = rows <= tableHover.rows && cols <= tableHover.cols
                    return (
                      <button
                        key={`cell-${row}-${col}`}
                        type='button'
                        className={`table-picker-cell${active ? ' active' : ''}`}
                        onMouseEnter={() => setTableHover({ rows, cols })}
                        onClick={() => {
                          setTablePickerOpen(false)
                          setTableHover({ rows: 0, cols: 0 })
                          run((cmd) => cmd.executeInsertTable(rows, cols), { preserveSelection: false, ensureFocus: true })
                        }}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
            <div className='table-picker-hint'>
              {tableHover.rows && tableHover.cols ? `${tableHover.rows} 脳 ${tableHover.cols}` : '请选择行列'}
            </div>
          </div>
        </div>
      ) : null}

      <div className='editor-canvas' ref={scrollRef} onMouseDown={preserveScroll} onScroll={handleScroll}>
        {!hasContent ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p style={{ color: '#94a3b8', fontSize: 15 }}>选择或创建文档开始编辑</p>
          </div>
        ) : (
          <div onMouseDown={preserveScroll}>
            <div className='canvas-editor' ref={containerRef} onMouseDown={preserveScroll} />
            <input type="file" name="file-docx" style={{ display: 'none' }} id="file-docx" accept=".docx" />
          </div>
        )}
      </div>
    </section>
  )
}

export default EditorPane
