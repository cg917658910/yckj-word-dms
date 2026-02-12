import { ipcMain } from 'electron'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import {
  ensureDocumentFile,
  ensureTemplateFile,
  getDocumentById,
  getTemplateById,
  touchDocument,
  touchTemplate,
} from './db'

type TargetType = 'doc' | 'template'

let server: http.Server | null = null
let port = 0
let readyPromise: Promise<void> | null = null
const BRIDGE_PORT = Number(process.env.ONLYOFFICE_BRIDGE_PORT || 59050)

type OnlyOfficeRuntimeConfig = {
  serverUrl: string
  accessHost: string
  tokenEnabled: boolean
  tokenSecret: string
}

const normalizeHost = (value: string) => value.trim().replace(/^"+|"+$/g, '').replace(/^'+|'+$/g, '')

const loadRuntimeConfig = (): OnlyOfficeRuntimeConfig => {
  // IMPORTANT:
  // CoAuthoring.server.port (commonly 8000) is an internal service port, not the public web endpoint.
  // Public endpoint should be nginx/front service, e.g. http://127.0.0.1 or https://host:8443.
  const envServerUrl = (process.env.ONLYOFFICE_SERVER_URL || '').trim()
  const serverUrl = (envServerUrl || 'http://127.0.0.1').replace(/\/$/, '')
  const tokenEnabled = Boolean(false)
  const tokenSecret = String( process.env.ONLYOFFICE_JWT_SECRET || ''
  )

  const envAccessHost = normalizeHost(process.env.ONLYOFFICE_DOC_ACCESS_HOST || '')
  const defaultAccessHost =
    /:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(serverUrl) || /:\/\/(127\.0\.0\.1|localhost)\b/i.test(serverUrl)
      ? '127.0.0.1'
      : 'host.docker.internal'
  const accessHost = envAccessHost || defaultAccessHost

  return { serverUrl, accessHost, tokenEnabled, tokenSecret }
}

const RUNTIME = loadRuntimeConfig()
const baseUrl = () => `http://127.0.0.1:${port}`
const DOC_SERVER_URL = RUNTIME.serverUrl
const DOC_ACCESS_HOST = RUNTIME.accessHost
const baseUrlForDocServer = () => `http://${DOC_ACCESS_HOST}:${port}`

const toBase64Url = (input: Buffer | string) =>
  Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')

const signJwt = (payload: Record<string, unknown>, secret: string) => {
  const header = { alg: 'HS256', typ: 'JWT' }
  const encodedHeader = toBase64Url(JSON.stringify(header))
  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const body = `${encodedHeader}.${encodedPayload}`
  const signature = crypto.createHmac('sha256', secret).update(body).digest()
  return `${body}.${toBase64Url(signature)}`
}

const parseTarget = (pathname: string) => {
  const parts = pathname.split('/').filter(Boolean)
  if (parts.length < 4 || parts[0] !== 'onlyoffice') return null
  const action = parts[1]
  const type = parts[2] as TargetType
  const id = Number(parts[3])
  if ((type !== 'doc' && type !== 'template') || !Number.isFinite(id)) return null
  return { action, type, id }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Access-Control-Expose-Headers':
    'Content-Length,Content-Range,Accept-Ranges,Content-Disposition,Content-Type',
}

const sendJson = (res: http.ServerResponse, payload: unknown, status = 200) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    ...corsHeaders,
  })
  res.end(JSON.stringify(payload))
}

const normalizeWordExt = (filePath: string) => {
  const ext = path.extname(filePath || '').toLowerCase()
  const supported = new Set(['.docx', '.doc', '.odt', '.rtf', '.txt', '.html', '.htm'])
  return supported.has(ext) ? ext : '.docx'
}

const mimeByExt: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.rtf': 'application/rtf',
  '.txt': 'text/plain; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
}

const toSafeFileName = (name: string, ext: string) => {
  const raw = (name || 'document').replace(/\.[^.]+$/i, '')
  const ascii = raw.replace(/[^a-zA-Z0-9._-]/g, '_').replace(/_+/g, '_').slice(0, 80) || 'document'
  return `${ascii}${ext}`
}

const readBody = async (req: http.IncomingMessage) =>
  await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })

const getRecord = async (type: TargetType, id: number) => {
  if (type === 'doc') return await getDocumentById(id)
  return await getTemplateById(id)
}

const parseByteRange = (rangeHeader: string, total: number) => {
  // Support: bytes=start-end | bytes=start- | bytes=-suffix
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
  if (!match) return null
  const startRaw = match[1]
  const endRaw = match[2]

  if (!startRaw && !endRaw) return null

  // suffix: last N bytes
  if (!startRaw && endRaw) {
    const suffix = Number(endRaw)
    if (!Number.isFinite(suffix) || suffix <= 0) return null
    const start = Math.max(total - suffix, 0)
    const end = total - 1
    return { start, end }
  }

  const start = Number(startRaw)
  if (!Number.isFinite(start) || start < 0) return null

  // open-ended: bytes=start-
  if (!endRaw) {
    if (start >= total) return null
    return { start, end: total - 1 }
  }

  const end = Number(endRaw)
  if (!Number.isFinite(end) || end < start) return null
  if (start >= total) return null
  return { start, end: Math.min(end, total - 1) }
}

const startServer = () => {
  if (server) return
  server = http.createServer(async (req, res) => {
    try {
      if (req.method === 'OPTIONS') {
        res.writeHead(204, {
          ...corsHeaders,
        })
        res.end()
        return
      }
      if (!req.url) {
        res.writeHead(404, corsHeaders)
        res.end()
        return
      }
      const url = new URL(req.url, baseUrl())
      if (url.pathname === '/onlyoffice/ping') {
        sendJson(res, { ok: true, port })
        return
      }
      const target = parseTarget(url.pathname)
      if (!target) {
        res.writeHead(404, corsHeaders)
        res.end()
        return
      }
      if (target.action === 'file' && req.method === 'GET') {
        const record = await getRecord(target.type, target.id)
        if (!record?.filePath || !fs.existsSync(record.filePath)) {
          res.writeHead(404, corsHeaders)
          res.end()
          return
        }
        const ext = normalizeWordExt(record.filePath)
        const stat = fs.statSync(record.filePath)
        const total = stat.size
        const filename = toSafeFileName((record as any).title || (record as any).name || 'document', ext)
        const range = req.headers.range
        if (range && !range.includes(',')) {
          const parsed = parseByteRange(range, total)
          if (!parsed) {
            res.writeHead(416, {
              'Content-Range': `bytes */${total}`,
              ...corsHeaders,
            })
            res.end()
            return
          }
          const { start, end } = parsed
          res.writeHead(206, {
            'Content-Type': mimeByExt[ext] || 'application/octet-stream',
            'Content-Disposition': `inline; filename="${filename}"`,
            'Accept-Ranges': 'bytes',
            'Content-Range': `bytes ${start}-${end}/${total}`,
            'Content-Length': String(end - start + 1),
            ...corsHeaders,
          })
          fs.createReadStream(record.filePath, { start, end }).pipe(res)
          return
        }
        res.writeHead(200, {
          'Content-Type': mimeByExt[ext] || 'application/octet-stream',
          'Content-Disposition': `inline; filename="${filename}"`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(total),
          ...corsHeaders,
        })
        fs.createReadStream(record.filePath).pipe(res)
        return
      }
      if (target.action === 'callback' && req.method === 'POST') {
        const body = await readBody(req)
        let payload: any = null
        try {
          payload = JSON.parse(body)
        } catch {
          sendJson(res, { error: 1 }, 400)
          return
        }
        const status = Number(payload?.status ?? -1)
        if ((status === 2 || status === 6) && typeof payload?.url === 'string') {
          const record = await getRecord(target.type, target.id)
          if (record?.filePath) {
            const fileRes = await fetch(payload.url)
            if (fileRes.ok) {
              const data = Buffer.from(await fileRes.arrayBuffer())
              await fs.promises.writeFile(record.filePath, data)
              if (target.type === 'doc') {
                await touchDocument(target.id)
              } else {
                await touchTemplate(target.id)
              }
            }
          }
        }
        sendJson(res, { error: 0 })
        return
      }
      res.writeHead(404, corsHeaders)
      res.end()
    } catch {
      res.writeHead(500, corsHeaders)
      res.end()
    }
  })
  readyPromise = new Promise((resolve) => {
    // Listen on all interfaces so Document Server container can reach host via host.docker.internal.
    const bind = (targetPort: number) => {
      if (!server) {
        resolve()
        return
      }
      const onError = (err: NodeJS.ErrnoException) => {
        server?.off('error', onError)
        if (err?.code === 'EADDRINUSE' && targetPort !== 0) {
          bind(0)
          return
        }
        resolve()
      }
      server.once('error', onError)
      server.listen(targetPort, '0.0.0.0', () => {
        server?.off('error', onError)
        const addr = server?.address()
        if (typeof addr === 'object' && addr) {
          port = addr.port
        }
        resolve()
      })
    }
    bind(BRIDGE_PORT)
  })
}

export const registerOnlyOfficeIpc = () => {
  startServer()
  ipcMain.handle(
    'onlyoffice:get-config',
    async (_event, payload: { type: TargetType; id: number; title: string }) => {
      startServer()
      await readyPromise
      const record =
        payload.type === 'doc'
          ? await ensureDocumentFile(payload.id)
          : await ensureTemplateFile(payload.id)
      if (!record?.filePath || !fs.existsSync(record.filePath)) return null
      const stat = fs.statSync(record.filePath)
      const ext = normalizeWordExt(record.filePath)
      const config = {
        scriptUrl: `${DOC_SERVER_URL}/web-apps/apps/api/documents/api.js`,
        documentServerUrl: `${DOC_SERVER_URL}/`,
        document: {
          title: payload.title,
          url: `${baseUrlForDocServer()}/onlyoffice/file/${payload.type}/${payload.id}/${encodeURIComponent(toSafeFileName(payload.title, ext))}`,
          fileType: ext.slice(1),
          // Use a one-time key to avoid stale cache collisions in local single-user mode.
          key: `${payload.type}-${payload.id}-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
          permissions: {
            edit: true,
            download: true,
            print: true,
          },
        },
        editorConfig: {
          callbackUrl: `${baseUrlForDocServer()}/onlyoffice/callback/${payload.type}/${payload.id}`,
          mode: 'edit',
          lang: 'zh-CN',
          user: { id: 'local-user', name: 'local-user' },
          customization: {
            about: false,
            feedback: false,
            spellcheck: false,
          },
          forcesave: false,
        },
      }
      if (RUNTIME.tokenEnabled && RUNTIME.tokenSecret) {
        const documentToken = signJwt({ document: config.document }, RUNTIME.tokenSecret)
        const editorToken = signJwt({ editorConfig: config.editorConfig }, RUNTIME.tokenSecret)
        ;(config as any).document.token = documentToken
        ;(config as any).editorConfig.token = editorToken
        ;(config as any).token = signJwt(
          {
            document: config.document,
            documentType: 'word',
            editorConfig: config.editorConfig,
            type: 'desktop',
          },
          RUNTIME.tokenSecret
        )
      }
      return config
    }
  )
}


