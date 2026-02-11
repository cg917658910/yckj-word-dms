import { app, ipcMain } from 'electron'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import initSqlJs, { Database } from 'sql.js'
import { ensureUniquePath, normalizeHtml } from './utils'

export type FolderRow = {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}

export type DocSummary = {
  id: number
  folderId: number | null
  title: string
  snippet: string
  updatedAt: string
  size: number
  filePath: string | null
}

export type DocDetail = {
  id: number
  folderId: number | null
  title: string
  updatedAt: string
  createdAt: string
  filePath: string | null
  size: number
}

export type TemplateRow = {
  id: number
  name: string
  content: string
  filePath?: string | null
  updatedAt: string
  size?: number
  lastUsedAt?: string | null
  usageCount?: number | null
  folderId?: number | null
}

export type TemplateFolderRow = {
  id: number
  name: string
  parentId: number | null
  sortOrder: number
}

export type CreateFolderInput = {
  name: string
  parentId: number | null
}

export type CreateTemplateFolderInput = {
  name: string
  parentId: number | null
}

export type RenameTemplateFolderInput = {
  id: number
  name: string
}

export type RenameFolderInput = {
  id: number
  name: string
}

export type CreateDocInput = {
  folderId: number | null
  title: string
  content?: string
}

export type RenameDocInput = {
  id: number
  title: string
}

export type MoveDocInput = {
  id: number
  folderId: number | null
}

export type CopyDocInput = {
  id: number
  title: string
}

export type FindReplaceInput = {
  query: string
  replace: string
  folderId: number | null
}

export type CreateTemplateInput = {
  name: string
  content: string
  folderId?: number | null
}

export type UpdateTemplateInput = {
  id: number
  name: string
  content: string
  folderId?: number | null
}

export type RenameTemplateInput = {
  id: number
  name: string
}

export type CopyTemplateInput = {
  id: number
  name: string
}

export type CreateDocFromTemplateInput = {
  templateId: number
  folderId: number | null
  title: string
}

export type CreateTemplateFromFileInput = {
  name: string
  sourcePath: string
  folderId?: number | null
}

export type MoveTemplateInput = {
  id: number
  folderId: number | null
}

let db: Database | null = null
let sqlReady: Promise<Database> | null = null

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

const getDataDir = () => {
  //const dir = path.join(app.getPath('userData'), 'data')
  const dir =  path.join(process.env.APP_ROOT, 'data')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

const getDbPath = () => path.join(getDataDir(), 'db.sqlite')

const ensureDocsDir = () => {
  const dir = path.join(getDataDir(), 'files', 'documents')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

const ensureTemplatesDir = () => {
  const dir = path.join(getDataDir(), 'files', 'templates')
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  return dir
}

const sanitizeFileName = (input: string) =>
  input
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80) || '文档'

const buildDocxHtml = (content?: string) => {
  const body = normalizeHtml(content || '<p></p>')
  return `<!doctype html><html><head><meta charset="utf-8"/></head><body>${body}</body></html>`
}

const writeDocxFile = async (filePath: string, content?: string) => {
  const htmlToDocx = (await import('html-to-docx')).default
  const html = buildDocxHtml(content)
  const docxResult = await htmlToDocx(html)
  const docxBuffer: Buffer = Buffer.isBuffer(docxResult)
    ? docxResult
    : docxResult instanceof ArrayBuffer
      ? Buffer.from(new Uint8Array(docxResult))
      : typeof Blob !== 'undefined' && docxResult instanceof Blob
        ? Buffer.from(new Uint8Array(await docxResult.arrayBuffer()))
        : Buffer.from(docxResult as any)
  await fs.promises.writeFile(filePath, docxBuffer)
}

async function ensureDb() {
  if (db) return db
  if (sqlReady) return sqlReady

  const dbPath = getDbPath()
  /* const legacyPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  if (!fs.existsSync(dbPath) && fs.existsSync(legacyPath)) {
    fs.copyFileSync(legacyPath, dbPath)
  } */

  sqlReady = (async () => {
    const SQL = await initSqlJs({
      locateFile: () => wasmPath,
    })

    let database: Database
    if (fs.existsSync(dbPath)) {
      const fileBuffer = fs.readFileSync(dbPath)
      database = new SQL.Database(new Uint8Array(fileBuffer))
    } else {
      database = new SQL.Database()
    }

    database.exec(`
      create table if not exists folders (
        id integer primary key autoincrement,
        name text not null,
        parent_id integer,
        sort_order integer default 0,
        created_at text default (datetime('now')),
        foreign key (parent_id) references folders(id) on delete cascade
      );

      create table if not exists documents (
        id integer primary key autoincrement,
        folder_id integer,
        title text not null,
        content text not null default '',
        file_path text,
        created_at text default (datetime('now')),
        updated_at text default (datetime('now')),
        foreign key (folder_id) references folders(id) on delete set null
      );

    create table if not exists templates (
      id integer primary key autoincrement,
      name text not null,
      content text not null,
      file_path text,
      updated_at text default (datetime('now')),
      usage_count integer default 0,
      last_used_at text,
      folder_id integer,
      foreign key (folder_id) references template_folders(id) on delete set null
    );
    create table if not exists template_folders (
      id integer primary key autoincrement,
      name text not null,
      parent_id integer,
      sort_order integer default 0,
      foreign key (parent_id) references template_folders(id) on delete cascade
    );
  `)

    const columns = all<{ name: string }>(database, 'pragma table_info(templates)')
    const hasUsage = columns.some((col) => col.name === 'usage_count')
    const hasLastUsed = columns.some((col) => col.name === 'last_used_at')
    const hasFolderId = columns.some((col) => col.name === 'folder_id')
    const hasTemplateFilePath = columns.some((col) => col.name === 'file_path')
    if (!hasUsage) {
      run(database, 'alter table templates add column usage_count integer default 0')
    }
    if (!hasLastUsed) {
      run(database, 'alter table templates add column last_used_at text')
    }
    if (!hasFolderId) {
      run(database, 'alter table templates add column folder_id integer')
    }
    if (!hasTemplateFilePath) {
      run(database, 'alter table templates add column file_path text')
    }

    const docColumns = all<{ name: string }>(database, 'pragma table_info(documents)')
    const hasFilePath = docColumns.some((col) => col.name === 'file_path')
    if (!hasFilePath) {
      run(database, 'alter table documents add column file_path text')
    }

    db = database
    await seedIfEmpty(database)
    //await migrateDocumentsToFiles(database)
    //await migrateTemplatesToFiles(database)
    saveDb(database, dbPath)
    return database
  })()

  return sqlReady
}

function saveDb(database: Database, dbPath: string) {
  const data = database.export()
  fs.writeFileSync(dbPath, Buffer.from(data))
}

function run(database: Database, sql: string, params: Array<string | number | null> = []) {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  stmt.step()
  stmt.free()
}

function get<T = Record<string, unknown>>(
  database: Database,
  sql: string,
  params: Array<string | number | null> = []
): T | null {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const row = stmt.step() ? (stmt.getAsObject() as T) : null
  stmt.free()
  return row
}

function all<T = Record<string, unknown>>(
  database: Database,
  sql: string,
  params: Array<string | number | null> = []
): T[] {
  const stmt = database.prepare(sql)
  stmt.bind(params)
  const rows: T[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject() as T)
  }
  stmt.free()
  return rows
}

async function seedIfEmpty(database: Database) {
  const folderCount = get<{ count: number }>(database, 'select count(1) as count from folders')
  if (folderCount?.count && folderCount.count > 0) return

  const addFolder = (name: string, parentName?: string, sortOrder = 0, map = new Map<string, number>()) => {
    const parentId = parentName ? map.get(parentName) ?? null : null
    run(database, 'insert into folders (name, parent_id, sort_order) values (?, ?, ?)', [name, parentId, sortOrder])
    const idRow = get<{ id: number }>(database, 'select last_insert_rowid() as id')
    if (idRow?.id) map.set(name, Number(idRow.id))
    return map
  }

  const folderMap = new Map<string, number>()

  addFolder('易诚无忧', undefined, 1, folderMap)

  const sampleContent = `XX有限公司保密工作领导小组成员履职报告<br/><br/>（20 年度）<br/><br/>姓名：______________ &nbsp;&nbsp;&nbsp;&nbsp; 部门或单位：______________ &nbsp;&nbsp;&nbsp;&nbsp; 职务：______________<br/>初任日期：______________ &nbsp;&nbsp;&nbsp;&nbsp; 序号：______________<br/><br/>填写说明：围绕分工职责和归口责任，具体说明已完成的工作、取得进展、存在问题及建议。`

  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    folderMap.get('易诚无忧') ?? null,
    '保密工作领导小组成员履职报告范文',
    sampleContent,
  ])

  run(database, 'insert into templates (name, content) values (?, ?)', ['工作报告', '本周完成：\n下周计划：\n风险问题：'])
  run(database, 'insert into templates (name, content) values (?, ?)', ['合同模板', '合同编号：\n甲方：\n乙方：\n条款：'])
  run(database, 'insert into templates (name, content) values (?, ?)', ['周报模板', '本周目标：\n完成情况：\n改进点：'])
  run(database, 'insert into templates (name, content) values (?, ?)', ['日报模板', '今日事项：\n时间记录：\n待办：'])
}

async function migrateDocumentsToFiles(database: Database) {
  const rows = all<{ id: number; title: string; content: string; filePath: string | null }>(
    database,
    'select id, title, content, file_path as filePath from documents'
  )
  if (!rows.length) return
  const docsDir = ensureDocsDir()
  const legacyDir = path.join(app.getPath('userData'), 'docx-files')
  for (const row of rows) {
    const hasFile = row.filePath && fs.existsSync(row.filePath)
    if (hasFile && row.filePath) {
      if (row.filePath.startsWith(legacyDir)) {
        const baseName = sanitizeFileName(row.title)
        const candidate = path.join(docsDir, `${row.id}-${baseName}.docx`)
        const targetPath = await ensureUniquePath(candidate)
        try {
          fs.copyFileSync(row.filePath, targetPath)
          run(database, 'update documents set file_path = ? where id = ?', [targetPath, row.id])
        } catch {
          // keep legacy path if copy fails
        }
      }
      if (row.content) {
        run(database, 'update documents set content = ? where id = ?', ['', row.id])
      }
      continue
    }
    if (!hasFile) {
      const baseName = sanitizeFileName(row.title)
      const candidate = path.join(docsDir, `${row.id}-${baseName}.docx`)
      const targetPath = await ensureUniquePath(candidate)
      await writeDocxFile(targetPath, row.content || '')
      run(database, 'update documents set file_path = ?, content = ? where id = ?', [
        targetPath,
        '',
        row.id,
      ])
    } else if (row.content) {
      run(database, 'update documents set content = ? where id = ?', ['', row.id])
    }
  }
}

async function migrateTemplatesToFiles(database: Database) {
  const rows = all<{ id: number; name: string; content: string; filePath: string | null }>(
    database,
    'select id, name, content, file_path as filePath from templates'
  )
  if (!rows.length) return
  const templatesDir = ensureTemplatesDir()
  for (const row of rows) {
    const hasFile = row.filePath && fs.existsSync(row.filePath)
    if (hasFile) {
      if (row.content) {
        run(database, 'update templates set content = ? where id = ?', ['', row.id])
      }
      continue
    }
    const baseName = sanitizeFileName(row.name)
    const candidate = path.join(templatesDir, `${row.id}-${baseName}.docx`)
    const targetPath = await ensureUniquePath(candidate)
    await writeDocxFile(targetPath, row.content || '')
    run(database, 'update templates set file_path = ?, content = ? where id = ?', [targetPath, '', row.id])
  }
}

async function listFolders(): Promise<FolderRow[]> {
  const database = await ensureDb()
  return all<FolderRow>(
    database,
    'select id, name, parent_id as parentId, sort_order as sortOrder from folders order by name collate nocase asc, id asc'
  )
}

export async function listTemplateFolders(): Promise<TemplateFolderRow[]> {
  const database = await ensureDb()
  return all<TemplateFolderRow>(
    database,
    'select id, name, parent_id as parentId, sort_order as sortOrder from template_folders order by name collate nocase asc, id asc'
  )
}

async function listDocuments(folderId: number | null): Promise<DocSummary[]> {
  const database = await ensureDb()
  const rows = folderId !== null
    ? all<{ id: number; folderId: number | null; title: string; filePath: string | null; updatedAt: string }>(
        database,
        `select id, folder_id as folderId, title, file_path as filePath,
        updated_at as updatedAt
        from documents where folder_id = ? order by datetime(created_at) desc`,
        [folderId]
      )
    : all<{ id: number; folderId: number | null; title: string; filePath: string | null; updatedAt: string }>(
        database,
        `select id, folder_id as folderId, title, file_path as filePath,
        updated_at as updatedAt
        from documents order by datetime(created_at) desc`
      )

  return rows.map((row) => {
    let size = 0
    if (row.filePath && fs.existsSync(row.filePath)) {
      try {
        size = fs.statSync(row.filePath).size
      } catch {
        size = 0
      }
    }
    return {
      id: row.id,
      folderId: row.folderId,
      title: row.title,
      snippet: '',
      updatedAt: row.updatedAt,
      size,
      filePath: row.filePath ?? null,
    }
  })
}

async function findAndReplace(input: FindReplaceInput) {
  const database = await ensureDb()
  const rows = input.folderId !== null
    ? all<{ id: number; title: string }>(
        database,
        'select id, title from documents where folder_id = ?',
        [input.folderId]
      )
    : all<{ id: number; title: string }>(
        database,
        'select id, title from documents'
      )

  let updated = 0
  rows.forEach((row) => {
    if (!input.query) return
    const nextTitle = row.title.includes(input.query)
      ? row.title.split(input.query).join(input.replace)
      : row.title
    if (nextTitle !== row.title) {
      run(
        database,
        'update documents set title = ?, updated_at = datetime(\'now\') where id = ?',
        [nextTitle, row.id]
      )
      updated += 1
    }
  })
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return updated
}

async function getDocument(id: number): Promise<DocDetail | null> {
  const database = await ensureDb()
  const row = get<{
    id: number
    folderId: number | null
    title: string
    createdAt: string
    updatedAt: string
    filePath: string | null
  }>(
    database,
    'select id, folder_id as folderId, title, created_at as createdAt, updated_at as updatedAt, file_path as filePath from documents where id = ? ',
    [id]
  )
  if (!row) return null
  let size = 0
  if (row.filePath && fs.existsSync(row.filePath)) {
    try {
      size = fs.statSync(row.filePath).size
    } catch {
      size = 0
    }
  }
  return {
    ...row,
    filePath: row.filePath ?? null,
    size,
  }
}

export async function getDocumentById(id: number): Promise<DocDetail | null> {
  return getDocument(id)
}

export async function getTemplateById(id: number): Promise<TemplateRow | null> {
  const database = await ensureDb()
  const row = get<TemplateRow>(
    database,
    'select id, name, content, file_path as filePath, updated_at as updatedAt, usage_count as usageCount, last_used_at as lastUsedAt, folder_id as folderId from templates where id = ?',
    [id]
  )
  if (!row) return null
  let size = 0
  if (row.filePath && fs.existsSync(row.filePath)) {
    try {
      size = fs.statSync(row.filePath).size
    } catch {
      size = 0
    }
  }
  return {
    ...row,
    size,
  }
}

export async function touchDocument(id: number) {
  const database = await ensureDb()
  run(database, 'update documents set updated_at = datetime(\'now\') where id = ?', [id])
  saveDb(database, getDbPath())
  return true
}

export async function touchTemplate(id: number) {
  const database = await ensureDb()
  run(database, 'update templates set updated_at = datetime(\'now\') where id = ?', [id])
  saveDb(database, getDbPath())
  return true
}

async function saveDocument(input: { id: number; title: string; content: string }) {
  const database = await ensureDb()
  const doc = await getDocument(input.id)
  if (doc?.filePath) {
    await writeDocxFile(doc.filePath, input.content)
  }
  run(database, 'update documents set title = ?, content = ?, updated_at = datetime(\'now\') where id = ?', [
    input.title,
    '',
    input.id,
  ])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return await getDocument(input.id)
}

async function createFolder(input: CreateFolderInput) {
  const database = await ensureDb()
  run(database, 'insert into folders (name, parent_id, sort_order) values (?, ?, ?)', [
    input.name,
    input.parentId,
    Date.now(),
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return Number(row?.id ?? 0)
}

export async function createTemplateFolder(input: CreateTemplateFolderInput) {
  const database = await ensureDb()
  run(database, 'insert into template_folders (name, parent_id, sort_order) values (?, ?, ?)', [
    input.name,
    input.parentId,
    Date.now(),
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return Number(row?.id ?? 0)
}

async function renameFolder(input: RenameFolderInput) {
  const database = await ensureDb()
  run(database, 'update folders set name = ? where id = ?', [input.name, input.id])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

export async function renameTemplateFolder(input: RenameTemplateFolderInput) {
  const database = await ensureDb()
  run(database, 'update template_folders set name = ? where id = ?', [input.name, input.id])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

async function deleteFolder(id: number) {
  const database = await ensureDb()
  run(database, 'delete from folders where id = ?', [id])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

export async function deleteTemplateFolder(id: number) {
  const database = await ensureDb()
  run(database, 'delete from template_folders where id = ?', [id])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

//count documents
async function countDocs() {
  const database = await ensureDb()
  const row = get<{ count: number }>(database, 'select count(1) as count from documents')
  return row?.count ?? 0
}

async function createDocument(input: CreateDocInput) {
  const database = await ensureDb()
  // 试用期限制创建文档数量
  const currentCount = get<{ count: number }>(database, 'select count(1) as count from documents')
  if ((currentCount?.count ?? 0) >= 100) {
   //弹窗提示
   const { dialog } = await import('electron')
   dialog.showErrorBox('试用限制', '试用版最多只能创建100个文档，如需继续使用请联系开发者。')
   return null
  }
  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    input.folderId,
    input.title,
    '',
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  if (row?.id) {
    const docsDir = ensureDocsDir()
    const baseName = sanitizeFileName(input.title)
    const candidate = path.join(docsDir, `${row.id}-${baseName}.docx`)
    const filePath = await ensureUniquePath(candidate)
    try {
      await writeDocxFile(filePath, input.content)
      run(database, 'update documents set file_path = ?, updated_at = datetime(\'now\') where id = ?', [
        filePath,
        row.id,
      ])
    } catch (error) {
      run(database, 'delete from documents where id = ?', [row.id])
      throw error
    }
  }
  const doc = row?.id ? await getDocument(Number(row.id)) : null
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return doc
}

async function renameDocument(input: RenameDocInput) {
  const database = await ensureDb()
  const current = await getDocument(input.id)
  let filePath = current?.filePath ?? null
  if (current?.filePath && fs.existsSync(current.filePath)) {
    const dir = path.dirname(current.filePath)
    const ext = path.extname(current.filePath) || '.docx'
    const baseName = `${input.id}-${sanitizeFileName(input.title)}`
    const candidate = path.join(dir, `${baseName}${ext}`)
    const nextPath = await ensureUniquePath(candidate)
    if (nextPath !== current.filePath) {
      try {
        fs.renameSync(current.filePath, nextPath)
        filePath = nextPath
      } catch {
        filePath = current.filePath
      }
    }
  }
  run(database, 'update documents set title = ?, file_path = ?, updated_at = datetime(\'now\') where id = ?', [
    input.title,
    filePath,
    input.id,
  ])
  const doc = await getDocument(input.id)
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return doc
}

async function moveDocument(input: MoveDocInput) {
  const database = await ensureDb()
  run(database, 'update documents set folder_id = ?, updated_at = datetime(\'now\') where id = ?', [
    input.folderId,
    input.id,
  ])
  const doc = await getDocument(input.id)
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return doc
}

async function copyDocument(input: CopyDocInput) {
  const database = await ensureDb()
  const source = await getDocument(input.id)
  if (!source?.filePath || !fs.existsSync(source.filePath)) return null
  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    source.folderId,
    input.title,
    '',
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  if (!row?.id) return null
  const docsDir = ensureDocsDir()
  const baseName = sanitizeFileName(input.title)
  const candidate = path.join(docsDir, `${row.id}-${baseName}.docx`)
  const filePath = await ensureUniquePath(candidate)
  try {
    fs.copyFileSync(source.filePath, filePath)
    run(database, 'update documents set file_path = ?, updated_at = datetime(\'now\') where id = ?', [
      filePath,
      row.id,
    ])
  } catch (error) {
    run(database, 'delete from documents where id = ?', [row.id])
    throw error
  }
  const doc = await getDocument(row.id)
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return doc
}

async function deleteDocument(id: number) {
  const database = await ensureDb()
  const doc = await getDocument(id)
  if (doc?.filePath && fs.existsSync(doc.filePath)) {
    try {
      fs.unlinkSync(doc.filePath)
    } catch {
      // ignore delete errors
    }
  }
  run(database, 'delete from documents where id = ?', [id])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

async function listTemplates(): Promise<TemplateRow[]> {
  const database = await ensureDb()
  const rows = all<TemplateRow>(
    database,
    'select id, name, content, file_path as filePath, updated_at as updatedAt, usage_count as usageCount, last_used_at as lastUsedAt, folder_id as folderId from templates order by datetime(last_used_at) desc, usage_count desc, updated_at desc'
  )
  return rows.map((row) => {
    let size = 0
    if (row.filePath && fs.existsSync(row.filePath)) {
      try {
        size = fs.statSync(row.filePath).size
      } catch {
        size = 0
      }
    }
    return {
      ...row,
      size,
      content: row.content ?? '',
    }
  })
}

export async function createTemplate(input: CreateTemplateInput) {
  const database = await ensureDb()
  run(database, 'insert into templates (name, content, updated_at, folder_id) values (?, ?, datetime(\'now\'), ?)', [
    input.name,
    '',
    input.folderId ?? null,
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  if (row?.id) {
    const templatesDir = ensureTemplatesDir()
    const baseName = sanitizeFileName(input.name)
    const candidate = path.join(templatesDir, `${row.id}-${baseName}.docx`)
    const filePath = await ensureUniquePath(candidate)
    try {
      await writeDocxFile(filePath, input.content)
      run(database, 'update templates set file_path = ?, content = ? where id = ?', [filePath, '', row.id])
    } catch (error) {
      run(database, 'delete from templates where id = ?', [row.id])
      throw error
    }
  }
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return Number(row?.id ?? 0)
}

async function updateTemplate(input: UpdateTemplateInput) {
  const database = await ensureDb()
  const current = get<{ filePath: string | null }>(database, 'select file_path as filePath from templates where id = ?', [
    input.id,
  ])
  const templatesDir = ensureTemplatesDir()
  const baseName = sanitizeFileName(input.name)
  const desiredPath = await ensureUniquePath(path.join(templatesDir, `${input.id}-${baseName}.docx`))
  let filePath = current?.filePath ?? null
  if (filePath && filePath !== desiredPath && fs.existsSync(filePath)) {
    try {
      fs.renameSync(filePath, desiredPath)
      filePath = desiredPath
    } catch {
      filePath = filePath
    }
  }
  if (!filePath) {
    filePath = desiredPath
  }
  await writeDocxFile(filePath, input.content)
  if (current?.filePath && current.filePath !== filePath) {
    try {
      if (fs.existsSync(current.filePath)) fs.unlinkSync(current.filePath)
    } catch {
      // ignore cleanup errors
    }
  }
  run(database, 'update templates set name = ?, content = ?, folder_id = ?, file_path = ?, updated_at = datetime(\'now\') where id = ?', [
    input.name,
    '',
    input.folderId ?? null,
    filePath,
    input.id,
  ])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

async function renameTemplate(input: RenameTemplateInput) {
  const database = await ensureDb()
  const current = get<{ filePath: string | null }>(database, 'select file_path as filePath from templates where id = ?', [
    input.id,
  ])
  const templatesDir = ensureTemplatesDir()
  const baseName = sanitizeFileName(input.name)
  const desiredPath = await ensureUniquePath(path.join(templatesDir, `${input.id}-${baseName}.docx`))
  let filePath = current?.filePath ?? null
  if (filePath && filePath !== desiredPath && fs.existsSync(filePath)) {
    try {
      fs.renameSync(filePath, desiredPath)
      filePath = desiredPath
    } catch {
      filePath = filePath
    }
  }
  run(database, 'update templates set name = ?, file_path = ?, updated_at = datetime(\'now\') where id = ?', [
    input.name,
    filePath,
    input.id,
  ])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

async function copyTemplate(input: CopyTemplateInput) {
  const database = await ensureDb()
  const source = get<{ filePath: string | null; folderId: number | null }>(
    database,
    'select file_path as filePath, folder_id as folderId from templates where id = ?',
    [input.id]
  )
  run(database, 'insert into templates (name, content, updated_at, folder_id) values (?, ?, datetime(\'now\'), ?)', [
    input.name,
    '',
    source?.folderId ?? null,
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  if (!row?.id) return null
  const templatesDir = ensureTemplatesDir()
  const baseName = sanitizeFileName(input.name)
  const candidate = path.join(templatesDir, `${row.id}-${baseName}.docx`)
  const filePath = await ensureUniquePath(candidate)
  try {
    if (source?.filePath && fs.existsSync(source.filePath)) {
      fs.copyFileSync(source.filePath, filePath)
    } else {
      await writeDocxFile(filePath, '')
    }
    run(database, 'update templates set file_path = ? where id = ?', [filePath, row.id])
  } catch (error) {
    run(database, 'delete from templates where id = ?', [row.id])
    throw error
  }
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return Number(row.id)
}

export async function createTemplateFromFile(input: CreateTemplateFromFileInput) {
  const database = await ensureDb()
  run(database, 'insert into templates (name, content, updated_at, folder_id) values (?, ?, datetime(\'now\'), ?)', [
    input.name,
    '',
    input.folderId ?? null,
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  if (!row?.id) return null
  const templatesDir = ensureTemplatesDir()
  const baseName = sanitizeFileName(input.name)
  const candidate = path.join(templatesDir, `${row.id}-${baseName}.docx`)
  const filePath = await ensureUniquePath(candidate)
  const ext = path.extname(input.sourcePath).toLowerCase()
  try {
    if (ext === '.docx') {
      fs.copyFileSync(input.sourcePath, filePath)
    } else {
      const { toHtmlFromFile } = await import('./import')
      const html = await toHtmlFromFile(input.sourcePath)
      await writeDocxFile(filePath, html || '')
    }
    run(database, 'update templates set file_path = ? where id = ?', [filePath, row.id])
  } catch (error) {
    run(database, 'delete from templates where id = ?', [row.id])
    throw error
  }
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return Number(row.id)
}

async function moveTemplate(input: MoveTemplateInput) {
  const database = await ensureDb()
  run(database, 'update templates set folder_id = ?, updated_at = datetime(\'now\') where id = ?', [
    input.folderId,
    input.id,
  ])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

async function deleteTemplate(id: number) {
  const database = await ensureDb()
  const template = get<{ filePath: string | null }>(database, 'select file_path as filePath from templates where id = ?', [id])
  if (template?.filePath && fs.existsSync(template.filePath)) {
    try {
      fs.unlinkSync(template.filePath)
    } catch {
      // ignore delete errors
    }
  }
  run(database, 'delete from templates where id = ?', [id])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

export async function importTemplates(items: Array<{ name: string; content: string }>) {
  const database = await ensureDb()
  for (const item of items) {
    run(database, 'insert into templates (name, content, updated_at) values (?, ?, datetime(\'now\'))', [
      item.name,
      '',
    ])
    const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
    if (row?.id) {
      const templatesDir = ensureTemplatesDir()
      const baseName = sanitizeFileName(item.name)
      const candidate = path.join(templatesDir, `${row.id}-${baseName}.docx`)
      const filePath = await ensureUniquePath(candidate)
      await writeDocxFile(filePath, item.content)
      run(database, 'update templates set file_path = ?, content = ? where id = ?', [filePath, '', row.id])
    }
  }
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

async function createDocFromTemplate(input: CreateDocFromTemplateInput) {
  const database = await ensureDb()
  const template = get<{ name: string; filePath: string | null }>(
    database,
    'select name, file_path as filePath from templates where id = ?',
    [input.templateId]
  )
  if (!template) return null
  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    input.folderId,
    input.title,
    '',
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  if (!row?.id) return null
  const docsDir = ensureDocsDir()
  const baseName = sanitizeFileName(input.title || template.name)
  const candidate = path.join(docsDir, `${row.id}-${baseName}.docx`)
  const filePath = await ensureUniquePath(candidate)
  try {
    if (template.filePath && fs.existsSync(template.filePath)) {
      fs.copyFileSync(template.filePath, filePath)
    } else {
      await writeDocxFile(filePath, '')
    }
    run(database, 'update documents set file_path = ?, updated_at = datetime(\'now\') where id = ?', [
      filePath,
      row.id,
    ])
  } catch (error) {
    run(database, 'delete from documents where id = ?', [row.id])
    throw error
  }
  const doc = await getDocument(row.id)
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return doc
}

async function applyTemplate(payload: { templateId: number; docId: number }) {
  const database = await ensureDb()
  const template = get<{ filePath: string | null }>(
    database,
    'select file_path as filePath from templates where id = ?',
    [payload.templateId]
  )
  if (!template) return null
  const doc = await getDocument(payload.docId)
  if (!doc) return null
  let targetPath = doc.filePath
  if (!targetPath) {
    const docsDir = ensureDocsDir()
    const baseName = sanitizeFileName(doc.title)
    const candidate = path.join(docsDir, `${doc.id}-${baseName}.docx`)
    targetPath = await ensureUniquePath(candidate)
    run(database, 'update documents set file_path = ? where id = ?', [targetPath, doc.id])
  }
  if (template.filePath && fs.existsSync(template.filePath)) {
    fs.copyFileSync(template.filePath, targetPath)
  } else {
    await writeDocxFile(targetPath, '')
  }
  run(database, 'update documents set content = ?, updated_at = datetime(\'now\') where id = ?', [
    '',
    payload.docId,
  ])
  run(database, 'update templates set usage_count = coalesce(usage_count,0) + 1, last_used_at = datetime(\'now\') where id = ?', [
    payload.templateId,
  ])
  const updated = await getDocument(payload.docId)
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return updated
}

async function useTemplate(id: number) {
  const database = await ensureDb()
  run(database, 'update templates set usage_count = coalesce(usage_count,0) + 1, last_used_at = datetime(\'now\') where id = ?', [
    id,
  ])
  const dbPath = getDbPath()
  saveDb(database, dbPath)
  return true
}

export function registerDbIpc() {
  ipcMain.handle('db:init', async () => {
    await ensureDb()
    return true
  })

  ipcMain.handle('db:list-folders', async () => listFolders())
  ipcMain.handle('db:list-template-folders', async () => listTemplateFolders())
  ipcMain.handle('db:count-doc', async () => countDocs())
  ipcMain.handle('db:list-docs', async (_event, folderId: number | null) => listDocuments(folderId))
  ipcMain.handle('db:get-doc', async (_event, id: number) => getDocument(id))
  ipcMain.handle('db:save-doc', async (_event, input: { id: number; title: string; content: string }) => saveDocument(input))
  ipcMain.handle('db:create-folder', async (_event, input: CreateFolderInput) => createFolder(input))
  ipcMain.handle('db:rename-folder', async (_event, input: RenameFolderInput) => renameFolder(input))
  ipcMain.handle('db:delete-folder', async (_event, id: number) => deleteFolder(id))
  ipcMain.handle('db:create-template-folder', async (_event, input: CreateTemplateFolderInput) => createTemplateFolder(input))
  ipcMain.handle('db:rename-template-folder', async (_event, input: RenameTemplateFolderInput) => renameTemplateFolder(input))
  ipcMain.handle('db:delete-template-folder', async (_event, id: number) => deleteTemplateFolder(id))
  ipcMain.handle('db:create-doc', async (_event, input: CreateDocInput) => createDocument(input))
  ipcMain.handle('db:rename-doc', async (_event, input: RenameDocInput) => renameDocument(input))
  ipcMain.handle('db:move-doc', async (_event, input: MoveDocInput) => moveDocument(input))
  ipcMain.handle('db:copy-doc', async (_event, input: CopyDocInput) => copyDocument(input))
  ipcMain.handle('db:delete-doc', async (_event, id: number) => deleteDocument(id))
  ipcMain.handle('db:find-replace', async (_event, input: FindReplaceInput) => findAndReplace(input))
  ipcMain.handle('db:list-templates', async () => listTemplates())
  ipcMain.handle('db:create-template', async (_event, input: CreateTemplateInput) => createTemplate(input))
  ipcMain.handle('db:update-template', async (_event, input: UpdateTemplateInput) => updateTemplate(input))
  ipcMain.handle('db:rename-template', async (_event, input: RenameTemplateInput) => renameTemplate(input))
  ipcMain.handle('db:copy-template', async (_event, input: CopyTemplateInput) => copyTemplate(input))
  ipcMain.handle('db:create-template-from-file', async (_event, input: CreateTemplateFromFileInput) =>
    createTemplateFromFile(input)
  )
  ipcMain.handle('db:move-template', async (_event, input: MoveTemplateInput) => moveTemplate(input))
  ipcMain.handle('db:delete-template', async (_event, id: number) => deleteTemplate(id))
  ipcMain.handle('db:use-template', async (_event, id: number) => useTemplate(id))
  ipcMain.handle('db:create-doc-from-template', async (_event, input: CreateDocFromTemplateInput) =>
    createDocFromTemplate(input)
  )
  ipcMain.handle('db:apply-template', async (_event, payload: { templateId: number; docId: number }) =>
    applyTemplate(payload)
  )
}
