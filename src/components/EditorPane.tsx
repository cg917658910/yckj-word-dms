import Editor, { EditorMode, ElementType, RowFlex, TitleLevel } from '@hufe921/canvas-editor'
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
  onSave?: () => void
  isDirty?: boolean
  onDeleteDoc: () => void
  onDeleteTemplate: () => void
  onOpenFindReplace?: () => void
  activeDoc: DocDetail | null
  activeTemplate: TemplateRow | null
  formatDate: (value: string) => string
  value: string
  onChange: (value: string) => void
  onUserEdit?: () => void
  onHtmlChange?: (value: string) => void
  printRequestToken?: number
  pdfExportToken?: number
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
  onSave,
  isDirty,
  onDeleteDoc,
  onDeleteTemplate,
  onOpenFindReplace,
  activeDoc,
  activeTemplate,
  formatDate,
  value,
  onChange,
  onUserEdit,
  onHtmlChange,
  printRequestToken,
  pdfExportToken,
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
  const allowScrollUntilRef = useRef(0)
  const allowAutoScrollUntilRef = useRef(0)
  const lastPageNoRef = useRef<number | null>(null)
  const [tablePickerOpen, setTablePickerOpen] = useState(false)
  const [tableHover, setTableHover] = useState({ rows: 0, cols: 0 })
  const savedRangeRef = useRef<any | null>(null)
  const userInteractedRef = useRef(false)
  const [findOpen, setFindOpen] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [searchInfo, setSearchInfo] = useState<{ index: number; count: number } | null>(null)
  const lastPdfTokenRef = useRef<number | null>(null)
  const [rangeStyle, setRangeStyle] = useState<{ font?: string; size?: number } | null>(null)

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
    userInteractedRef.current = true
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
            }, 300)
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
      }, 300)
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

  const updateSearchInfo = () => {
    const instance = editorRef.current
    if (!instance) {
      setSearchInfo(null)
      return
    }
    const info = instance.command.getSearchNavigateInfo?.()
    if (!info || typeof info.count !== 'number') {
      setSearchInfo(null)
      return
    }
    setSearchInfo({ index: info.index, count: info.count })
  }

  const runSearch = () => {
    if (!editorRef.current) return
    const keyword = findText.trim()
    run((cmd) => cmd.executeSearch(keyword ? keyword : null, { isIgnoreCase: true }), {
      preserveSelection: false,
      ensureFocus: true,
    })
    window.setTimeout(() => updateSearchInfo(), 0)
  }

  const runReplaceCurrent = () => {
    if (!findText.trim()) return
    const index = typeof searchInfo?.index === 'number' ? searchInfo.index : undefined
    run((cmd) => cmd.executeReplace(replaceText, index !== undefined ? { index } : undefined), {
      preserveSelection: false,
      ensureFocus: true,
    })
    window.setTimeout(() => updateSearchInfo(), 0)
  }

  const runReplaceAll = () => {
    if (!findText.trim()) return
    run((cmd) => cmd.executeReplace(replaceText), { preserveSelection: false, ensureFocus: true })
    window.setTimeout(() => updateSearchInfo(), 0)
  }

  const handleScroll = () => {
    const target = scrollRef.current
    if (!target) return
    const now = Date.now()
    if (scrollLockRef.current) {
      target.scrollTop = lastScrollRef.current.top
      target.scrollLeft = lastScrollRef.current.left
      return
    }
    if (now < allowScrollUntilRef.current || now < allowAutoScrollUntilRef.current) {
      lastScrollRef.current = { top: target.scrollTop, left: target.scrollLeft }
      return
    }
    target.scrollTop = lastScrollRef.current.top
    target.scrollLeft = lastScrollRef.current.left
  }

  const handleWheel = () => {
    allowScrollUntilRef.current = Date.now() + 400
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
    const docxFileInput = document.querySelector<HTMLInputElement>('#file-docx')
    const htmlFileInput = document.querySelector<HTMLInputElement>('#file-html')

    instance.register.contextMenuList([
      {
        name: '导入Word',
        when: () => true,
        callback: () => {
          if (docxFileInput) docxFileInput.value = ''
          docxFileInput?.click()
        },
      },
      {
        name: '导出为PDF',
        when: () => true,
        callback: () => {
          onExport('pdf')
        },
      },
      {
        name: '导出为Word',
        when: () => true,
        callback: (command) => {
          ;(command as any).executeExportDocx({
            fileName: titleDraft || '文档',
          })
        },
      },
    ])

    if (docxFileInput) {
      docxFileInput.onchange = () => {
        const file = docxFileInput?.files?.[0]
        if (!file) return
        const reader = new FileReader()
        reader.onload = (event) => {
          const buffer = event?.target?.result
          if (buffer instanceof ArrayBuffer) {
            ;(instance.command as any).executeImportDocx({
              arrayBuffer: buffer,
            })
          }
          docxFileInput.value = ''
        }
        reader.readAsArrayBuffer(file)
      }
    }
    if (htmlFileInput) {
      htmlFileInput.onchange = async () => {
        const file = htmlFileInput?.files?.[0]
        if (!file) return
        const text = await file.text()
        const data = parseEditorData(text)
        editorRef.current?.command.executeSetValue(data as any)
        const nextValue = serializeEditorData(data)
        lastValueRef.current = nextValue
        onChange(nextValue)
        if (onHtmlChange && editorRef.current) {
          onHtmlChange(getHtml(editorRef.current))
        }
      }
    }
    editorRef.current = instance
    savedRangeRef.current = null
    lastValueRef.current = value
    userInteractedRef.current = false

    const handleChange = () => {
      const target = scrollRef.current
      if (target && preInputScrollRef.current) {
        const ctx = (instance.command as any).getRangeContext?.()
        const currentPage = typeof ctx?.startPageNo === 'number' ? ctx.startPageNo : null
        const { top, left, pageNo } = preInputScrollRef.current
        if (currentPage === pageNo) {
          target.scrollTop = top
          target.scrollLeft = left
        } else if (currentPage !== null && currentPage !== lastPageNoRef.current) {
          lastPageNoRef.current = currentPage
          allowAutoScrollUntilRef.current = Date.now() + 400
        }
        preInputScrollRef.current = null
      }
      if (userInteractedRef.current) {
        onUserEdit?.()
      }
      scheduleSave()
    }
    const handlePositionChange = () => {
      captureRange()
    }
    const handleRangeStyle = (payload: { font?: string; size?: number }) => {
      setRangeStyle(payload)
    }
    if ((instance as { listener?: { contentChange?: () => void } }).listener) {
      ;(instance as { listener: { contentChange?: () => void } }).listener.contentChange = handleChange
    }
    instance.eventBus.on('contentChange', handleChange)
    instance.eventBus.on('positionContextChange', handlePositionChange)
    instance.eventBus.on('rangeStyleChange', handleRangeStyle)

    if (onHtmlChange) {
      onHtmlChange(getHtml(instance))
    }

    const handleKeydown = (event: KeyboardEvent) => {
      const container = scrollRef.current
      if (!container) return
      const active = document.activeElement
      if (active && !container.contains(active)) return
      userInteractedRef.current = true
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
      instance.eventBus.off?.('rangeStyleChange', handleRangeStyle)
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

  useEffect(() => {
    if (!hasContent) return
    if (!editorRef.current) return
    if (!pdfExportToken) return
    if (lastPdfTokenRef.current === pdfExportToken) return
    lastPdfTokenRef.current = pdfExportToken
    const instance = editorRef.current
    const title = titleDraft || '文档'
    const exportPdf = async () => {
      const images = await instance.command.getImage({ mode: EditorMode.PRINT, pixelRatio: 2 })
      await window.api.exportPdfImages({ title, images })
    }
    exportPdf()
  }, [pdfExportToken, hasContent, titleDraft])

  useEffect(() => {
    if (!hasContent) return
    if (!editorRef.current) return
    if (!printRequestToken) return
    run((cmd) => cmd.executePrint(), { preserveSelection: false, ensureFocus: true })
  }, [printRequestToken, hasContent])

  // value changes are driven by editor events, avoid re-initializing on every update

  return (
    <section className='editor'>
      {isDirty ? (
        <div className='editor-unsaved'>● 未保存</div>
      ) : (
        <div className='editor-unsaved placeholder'> </div>
      )}
      <div className='editor-toolbar'>
        <div className='editor-format' onMouseDown={handleToolbarMouseDown}>
          <button className='tool' onClick={() => run((cmd) => cmd.executeUndo())} title='撤销'>
            Undo
          </button>
          <button className='tool' onClick={() => run((cmd) => cmd.executeRedo())} title='重做'>
            Redo
          </button>
          <button className='tool' onClick={() => onSave?.()} title='保存'>
            保存
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
            value={
              rangeStyle?.font && ['微软雅黑', '宋体', '黑体', '仿宋', '楷体', 'Arial', 'Times New Roman'].includes(rangeStyle.font)
                ? rangeStyle.font
                : '微软雅黑'
            }
            onChange={(event) => {
              const font = event.target.value
              if (font) run((cmd) => cmd.executeFont(font), { range: savedRangeRef.current })
            }}
          >
            {['微软雅黑', '宋体', '黑体', '仿宋', '楷体', 'Arial', 'Times New Roman'].map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
          <select
            className='tool-select'
            value={(() => {
              const base = [12, 14, 16, 18, 20, 22, 24, 28, 32]
              const current = rangeStyle?.size
              const list = current && !base.includes(current) ? [...base, current].sort((a, b) => a - b) : base
              const value = current && list.includes(current) ? String(current) : '14'
              return value
            })()}
            onChange={(event) => {
              const size = Number(event.target.value)
              if (!Number.isNaN(size)) run((cmd) => cmd.executeSize(size), { range: savedRangeRef.current })
            }}
          >
            {(() => {
              const base = [12, 14, 16, 18, 20, 22, 24, 28, 32]
              const current = rangeStyle?.size
              const list = current && !base.includes(current) ? [...base, current].sort((a, b) => a - b) : base
              return list.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))
            })()}
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
          <button
            className='tool'
            onClick={() => {
              setFindOpen((prev) => {
                if (prev) {
                  run((cmd) => cmd.executeSearch(null), { preserveSelection: false })
                  setSearchInfo(null)
                }
                return !prev
              })
            }}
            title='查找替换'
          >
            查找替换
          </button>
        </div>
        {findOpen ? (
          <div className='editor-find' onMouseDown={handleToolbarMouseDown}>
            <input
              className='find-input'
              value={findText}
              onChange={(event) => setFindText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') runSearch()
              }}
              placeholder='查找内容'
            />
            <button className='tool small' onClick={runSearch}>
              查找
            </button>
            <span className='find-count'>
              {searchInfo ? `${Math.min(searchInfo.index + 1, searchInfo.count)}/${searchInfo.count}` : '0/0'}
            </span>
            <button
              className='tool small'
              onClick={() => {
                run((cmd) => cmd.executeSearchNavigatePre(), { preserveSelection: false, ensureFocus: true })
                updateSearchInfo()
              }}
            >
              上一个
            </button>
            <button
              className='tool small'
              onClick={() => {
                run((cmd) => cmd.executeSearchNavigateNext(), { preserveSelection: false, ensureFocus: true })
                updateSearchInfo()
              }}
            >
              下一个
            </button>
            <input
              className='find-input'
              value={replaceText}
              onChange={(event) => setReplaceText(event.target.value)}
              placeholder='替换为'
            />
            <button className='tool small' onClick={runReplaceCurrent}>
              替换
            </button>
            <button className='tool small' onClick={runReplaceAll}>
              全部替换
            </button>
            <button
              className='tool small ghost'
              onClick={() => {
                setFindOpen(false)
                run((cmd) => cmd.executeSearch(null), { preserveSelection: false })
                setSearchInfo(null)
              }}
            >
              关闭
            </button>
          </div>
        ) : null}
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

      <div
        className='editor-canvas'
        ref={scrollRef}
        onMouseDown={preserveScroll}
        onScroll={handleScroll}
        onWheel={handleWheel}
      >
        {!hasContent ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
            <p style={{ color: '#94a3b8', fontSize: 15 }}>选择或创建文档开始编辑</p>
          </div>
        ) : (
          <div onMouseDown={preserveScroll}>
            <div className='canvas-editor' ref={containerRef} onMouseDown={preserveScroll} />
            <input type="file" name="file-docx" style={{ display: 'none' }} id="file-docx" accept=".docx" />
            <input type="file" name="file-html" style={{ display: 'none' }} id="file-html" accept=".html,.htm" />
          </div>
        )}
      </div>
    </section>
  )
}

export default EditorPane
