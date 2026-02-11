import { useEffect, useRef, useState } from 'react'
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
  docPreviewHtml: string
  docPreviewLoading: boolean
  templatePreviewHtml: string
  templatePreviewLoading: boolean
}

const scriptCache: Partial<Record<string, Promise<void>>> = {}
const loadScript = (src: string) => {
  if (scriptCache[src]) return scriptCache[src]
  scriptCache[src] = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`)
    if (existing) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(script)
  })
  return scriptCache[src]
}

const loadOnlyOfficeApi = async () => {
  // Try relative first to align with ranuts/document behavior in SPA/base paths.
  try {
    await loadScript('./web-apps/apps/api/documents/api.js')
    return
  } catch {
    await loadScript('/web-apps/apps/api/documents/api.js')
  }
}

let x2tInitPromise: Promise<any> | null = null
const ensureX2t = async () => {
  if (x2tInitPromise) return x2tInitPromise
  x2tInitPromise = new Promise(async (resolve, reject) => {
    try {
      await loadScript('/wasm/x2t/x2t.js')
      const mod = (window as any).Module
      if (!mod) {
        reject(new Error('x2t module missing'))
        return
      }
      if (mod.calledRun && mod.FS) {
        resolve(mod)
        return
      }
      mod.onRuntimeInitialized = () => {
        try {
          for (const dir of ['/working', '/working/media', '/working/fonts', '/working/themes']) {
            try {
              mod.FS.mkdir(dir)
            } catch {
              // ignore existing
            }
          }
          resolve(mod)
        } catch (e) {
          reject(e)
        }
      }
    } catch (e) {
      reject(e)
    }
  })
  return x2tInitPromise
}

const convertDocxToBin = async (bytes: Uint8Array, fileName: string) => {
  const x2t = await ensureX2t()
  const safe = (fileName || 'document.docx').replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
  const fromPath = `/working/${safe.endsWith('.docx') ? safe : `${safe}.docx`}`
  const toPath = `${fromPath}.bin`
  const paramsPath = '/working/params.xml'
  const params = `<?xml version="1.0" encoding="utf-8"?>
<TaskQueueDataConvert xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <m_sFileFrom>${fromPath}</m_sFileFrom>
  <m_sThemeDir>/working/themes</m_sThemeDir>
  <m_sFileTo>${toPath}</m_sFileTo>
  <m_bIsNoBase64>false</m_bIsNoBase64>
</TaskQueueDataConvert>`
  x2t.FS.writeFile(fromPath, bytes)
  x2t.FS.writeFile(paramsPath, params)
  const code = x2t.ccall('main1', 'number', ['string'], [paramsPath])
  if (code !== 0) throw new Error(`x2t convert failed: ${code}`)
  const out = x2t.FS.readFile(toPath, { encoding: 'binary' })
  return out instanceof Uint8Array ? out : new Uint8Array(out)
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
}: Props) => {
  const activeId = viewMode === 'doc' ? activeDoc?.id : activeTemplate?.id
  const activeTitle = viewMode === 'doc' ? activeDoc?.title : activeTemplate?.name
  const containerId = 'onlyoffice-container-host'
  const editorRef = useRef<{ destroyEditor?: () => void } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const phaseRef = useRef('init')

  useEffect(() => {
    if (!activeId || !activeTitle) {
      if (editorRef.current?.destroyEditor) {
        editorRef.current.destroyEditor()
        editorRef.current = null
      }
      return
    }
    let disposed = false
    let watchdogTimer: number | null = null

    const mount = async () => {
      setLoading(true)
      setError('')
      phaseRef.current = 'prepare'
      let docBytes: Uint8Array | null = null
      try {
        if (editorRef.current?.destroyEditor) {
          editorRef.current.destroyEditor()
          editorRef.current = null
        }
        const cfg = await window.api.onlyofficeGetConfig({
          type: viewMode,
          id: activeId,
          title: activeTitle,
        })
        if (!cfg) {
          setError('无法获取文档配置')
          setLoading(false)
          return
        }
        // Preflight: if file endpoint returns HTML, OnlyOffice will hang on loading.
        try {
          const preflight = await fetch(cfg.document.url, { method: 'GET' })
          const contentType = preflight.headers.get('content-type') || ''
          if (!preflight.ok) {
            setError(`文档读取失败: ${preflight.status}`)
            setLoading(false)
            return
          }
          if (contentType.toLowerCase().includes('text/html')) {
            setError(`文档地址返回 HTML（非文档流）: ${cfg.document.url}`)
            setLoading(false)
            return
          }
          if ((cfg.document.fileType || '').toLowerCase() === 'docx') {
            const bytes = new Uint8Array(await preflight.arrayBuffer())
            const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
            if (!isZip) {
              setError('文件扩展名为 docx，但内容不是有效 docx（缺少 PK 头）')
              setLoading(false)
              return
            }
            docBytes = bytes
          }
        } catch (preflightError) {
          setError(`文档地址不可访问: ${(preflightError as Error)?.message ?? 'unknown'}`)
          setLoading(false)
          return
        }
        await loadOnlyOfficeApi()
        phaseRef.current = 'api-loaded'
        if (disposed) return
        if (!window.DocsAPI?.DocEditor) {
          setError('OnlyOffice API 未加载')
          setLoading(false)
          return
        }
        editorRef.current = new window.DocsAPI.DocEditor(containerId, {
          documentType: 'word',
          type: 'desktop',
          document: cfg.document,
          editorConfig: cfg.editorConfig,
          height: '100%',
          width: '100%',
          events: {
            onAppReady: async () => {
              phaseRef.current = 'app-ready'
              if ((cfg.document.fileType || '').toLowerCase() !== 'docx') return
              try {
                const bytes = docBytes ?? new Uint8Array(await (await fetch(cfg.document.url)).arrayBuffer())
                phaseRef.current = 'converting'
                const bin = await convertDocxToBin(bytes, cfg.document.title || 'document.docx')
                phaseRef.current = 'opening-bin'
                ;(window as any).editor = editorRef.current
                ;(window as any).editor?.sendCommand?.({
                  command: 'asc_openDocument',
                  data: { buf: bin },
                })
              } catch (openErr) {
                const msg = (openErr as Error)?.message ?? 'unknown'
                setError(`文档转换/打开失败: ${msg}`)
                setLoading(false)
              }
            },
            onDocumentReady: () => {
              phaseRef.current = 'document-ready'
              if (watchdogTimer) {
                window.clearTimeout(watchdogTimer)
                watchdogTimer = null
              }
              try {
                ;(editorRef.current as any)?.showMessage?.(
                  '当前模式已禁用内置保存/打印，请使用右上角“使用本地 Word/WPS 打开”进行保存和打印。'
                )
              } catch {
                // ignore
              }
              setLoading(false)
              setError('')
            },
            onError: (event: any) => {
              phaseRef.current = 'error-event'
              if (watchdogTimer) {
                window.clearTimeout(watchdogTimer)
                watchdogTimer = null
              }
              const code = event?.data?.errorCode ?? event?.data?.code ?? 'unknown'
              const desc = event?.data?.errorDescription ?? event?.data?.description ?? ''
              setError(`编辑器错误(${code}) ${desc}`.trim())
              setLoading(false)
            },
          },
        })
        watchdogTimer = window.setTimeout(() => {
          setError(`编辑器启动超时（阶段: ${phaseRef.current}），请检查 onlyoffice 资源`)
          setLoading(false)
        }, 20000)
      } catch (err) {
        console.error(err)
        setError('编辑器加载失败')
        setLoading(false)
      }
    }

    mount()

    return () => {
      disposed = true
      if (editorRef.current?.destroyEditor) {
        editorRef.current.destroyEditor()
        editorRef.current = null
      }
      if (watchdogTimer) {
        window.clearTimeout(watchdogTimer)
        watchdogTimer = null
      }
    }
  }, [activeId, activeTitle, viewMode])

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
        <div className='doc-preview-placeholder' style={{ display: activeId ? 'none' : 'block' }}>
          请选择文档或模板
        </div>
        <div className='doc-preview-placeholder' style={{ display: loading ? 'block' : 'none' }}>
          正在加载编辑器...
        </div>
        <div className='doc-preview-placeholder' style={{ display: error ? 'block' : 'none' }}>
          {error}
        </div>
        <div id={containerId} className='onlyoffice-container' />
      </div>
    </section>
  )
}

export default EditorPane


