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

const loadOnlyOfficeApi = async (scriptUrl: string) => {
  try {
    await loadScript(scriptUrl)
    return { remote: true as const }
  } catch {
    // Fallback to bundled assets to keep editor available when DS is down.
    try {
      await loadScript('/web-apps/apps/api/documents/api.js')
      return { remote: false as const }
    } catch {
      throw new Error(`Failed to load script: ${scriptUrl}`)
    }
  }
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
        // Preflight from renderer only for local loopback URLs.
        // When using host.docker.internal, the URL is intended for Document Server container.
        const isDockerHostUrl = /:\/\/host\.docker\.internal(?::\d+)?\//i.test(cfg.document.url)
        if (!isDockerHostUrl) {
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
            const bytes = new Uint8Array(await preflight.arrayBuffer())
            const isZip = bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b
            if ((cfg.document.fileType || '').toLowerCase() === 'docx' && !isZip) {
              setError('文件扩展名为 docx，但内容不是有效 docx（缺少 PK 头）')
              setLoading(false)
              return
            }
          } catch (preflightError) {
            setError(`文档地址不可访问: ${(preflightError as Error)?.message ?? 'unknown'}`)
            setLoading(false)
            return
          }
        }
        const apiLoad = await loadOnlyOfficeApi(cfg.scriptUrl)
        phaseRef.current = 'api-loaded'
        if (disposed) return
        if (!window.DocsAPI?.DocEditor) {
          setError('OnlyOffice API 未加载')
          setLoading(false)
          return
        }
        editorRef.current = new window.DocsAPI.DocEditor(containerId, {
          documentServerUrl: cfg.documentServerUrl || undefined,
          documentType: 'word',
          type: 'desktop',
          document: cfg.document,
          editorConfig: cfg.editorConfig,
          height: '100%',
          width: '100%',
          events: {
            onAppReady: () => {
              phaseRef.current = 'app-ready'
            },
            onDocumentReady: () => {
              phaseRef.current = 'document-ready'
              if (watchdogTimer) {
                window.clearTimeout(watchdogTimer)
                watchdogTimer = null
              }
              if (!apiLoad.remote) {
                setError('Document Server 未启动：当前为本地降级模式，保存/打印不可用。请先启动 127.0.0.1:8443。')
              } else {
                setError('')
              }
              setLoading(false)
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


