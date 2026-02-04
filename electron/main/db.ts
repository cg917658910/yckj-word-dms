import path from 'node:path'
import fs from 'node:fs'
import { app, ipcMain } from 'electron'
import initSqlJs, { Database } from 'sql.js'
import { createRequire } from 'node:module'

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
}

export type DocDetail = {
  id: number
  folderId: number | null
  title: string
  content: string
  updatedAt: string
  createdAt: string
}

export type TemplateRow = {
  id: number
  name: string
  content: string
  updatedAt: string
}

export type CreateFolderInput = {
  name: string
  parentId: number | null
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

export type CreateTemplateInput = {
  name: string
  content: string
}

export type UpdateTemplateInput = {
  id: number
  name: string
  content: string
}

let db: Database | null = null
let sqlReady: Promise<Database> | null = null

const require = createRequire(import.meta.url)
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm')

async function ensureDb() {
  if (db) return db
  if (sqlReady) return sqlReady

  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')

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
        content text not null,
        created_at text default (datetime('now')),
        updated_at text default (datetime('now')),
        foreign key (folder_id) references folders(id) on delete set null
      );

      create table if not exists templates (
        id integer primary key autoincrement,
        name text not null,
        content text not null,
        updated_at text default (datetime('now'))
      );
    `)

    db = database
    await seedIfEmpty(database)
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

  addFolder('C1-信息收集', undefined, 1, folderMap)
  addFolder('mbti', 'C1-信息收集', 1, folderMap)
  addFolder('身心健康', 'C1-信息收集', 2, folderMap)
  addFolder('文旅设计', 'C1-信息收集', 3, folderMap)
  addFolder('新建文件夹', 'C1-信息收集', 4, folderMap)
  addFolder('易诚无忧', 'C1-信息收集', 5, folderMap)

  addFolder('C2-研究整理', undefined, 2, folderMap)
  addFolder('竞品拆解', 'C2-研究整理', 1, folderMap)
  addFolder('用户画像', 'C2-研究整理', 2, folderMap)

  addFolder('C3-终生成长', undefined, 3, folderMap)
  addFolder('读书笔记', 'C3-终生成长', 1, folderMap)
  addFolder('学习路径', 'C3-终生成长', 2, folderMap)

  addFolder('C4-创业一生', undefined, 4, folderMap)
  addFolder('项目规划', 'C4-创业一生', 1, folderMap)

  addFolder('C5-资料文档', undefined, 5, folderMap)
  addFolder('模板归档', 'C5-资料文档', 1, folderMap)

  addFolder('C6-剪裁前行', undefined, 6, folderMap)
  addFolder('复盘记录', 'C6-剪裁前行', 1, folderMap)

  const sampleContent = `XX有限公司保密工作领导小组成员履职报告<br/><br/>（20 年度）<br/><br/>姓名：______________ &nbsp;&nbsp;&nbsp;&nbsp; 部门或单位：______________ &nbsp;&nbsp;&nbsp;&nbsp; 职务：______________<br/>初任日期：______________ &nbsp;&nbsp;&nbsp;&nbsp; 序号：______________<br/><br/>填写说明：围绕分工职责和归口责任，具体说明已完成的工作、取得进展、存在问题及建议。`

  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    folderMap.get('易诚无忧') ?? null,
    '附件2-1',
    sampleContent,
  ])

  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    folderMap.get('模板归档') ?? null,
    '无标题笔记',
    '这里是你的灵感草稿，可以开始记录想法。',
  ])

  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    folderMap.get('项目规划') ?? null,
    '【易诚无忧】任务管理系统开发方案',
    '需求背景、系统流程、角色分工、里程碑等内容在此归档。',
  ])

  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    folderMap.get('项目规划') ?? null,
    '【易诚无忧】任务管理系统需求',
    '功能边界、权限矩阵、迭代计划在此记录。',
  ])

  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    folderMap.get('项目规划') ?? null,
    '【易诚无忧】社区服务小程序需求',
    '用户端、平台端、组织、商家、主理人需求要点。',
  ])

  run(database, 'insert into templates (name, content) values (?, ?)', [
    '会议纪要',
    '会议主题：\n时间：\n参会人：\n\n议题与结论：',
  ])
  run(database, 'insert into templates (name, content) values (?, ?)', ['工作报告', '本周完成：\n下周计划：\n风险问题：'])
  run(database, 'insert into templates (name, content) values (?, ?)', ['合同模板', '合同编号：\n甲方：\n乙方：\n条款：'])
  run(database, 'insert into templates (name, content) values (?, ?)', ['周报模板', '本周目标：\n完成情况：\n改进点：'])
  run(database, 'insert into templates (name, content) values (?, ?)', ['日报模板', '今日事项：\n时间记录：\n待办：'])
}

async function listFolders(): Promise<FolderRow[]> {
  const database = await ensureDb()
  return all<FolderRow>(
    database,
    'select id, name, parent_id as parentId, sort_order as sortOrder from folders order by sort_order asc, id asc'
  )
}

async function listDocuments(folderId: number | null): Promise<DocSummary[]> {
  const database = await ensureDb()
  if (folderId !== null) {
    return all<DocSummary>(
      database,
      `select id, folder_id as folderId, title,
      substr(replace(replace(content, char(10), ' '), char(13), ' '), 1, 120) as snippet,
      updated_at as updatedAt,
      length(content) as size
      from documents where folder_id = ? order by datetime(updated_at) desc`,
      [folderId]
    )
  }
  return all<DocSummary>(
    database,
    `select id, folder_id as folderId, title,
    substr(replace(replace(content, char(10), ' '), char(13), ' '), 1, 120) as snippet,
    updated_at as updatedAt,
    length(content) as size
    from documents order by datetime(updated_at) desc`
  )
}

async function getDocument(id: number): Promise<DocDetail | null> {
  const database = await ensureDb()
  return get<DocDetail>(
    database,
    'select id, folder_id as folderId, title, content, created_at as createdAt, updated_at as updatedAt from documents where id = ? ',
    [id]
  )
}

async function saveDocument(input: { id: number; title: string; content: string }) {
  const database = await ensureDb()
  run(database, 'update documents set title = ?, content = ?, updated_at = datetime(\'now\') where id = ?', [
    input.title,
    input.content,
    input.id,
  ])
  const doc = await getDocument(input.id)
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return doc
}

async function createFolder(input: CreateFolderInput) {
  const database = await ensureDb()
  run(database, 'insert into folders (name, parent_id, sort_order) values (?, ?, ?)', [
    input.name,
    input.parentId,
    Date.now(),
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return Number(row?.id ?? 0)
}

async function renameFolder(input: RenameFolderInput) {
  const database = await ensureDb()
  run(database, 'update folders set name = ? where id = ?', [input.name, input.id])
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return true
}

async function deleteFolder(id: number) {
  const database = await ensureDb()
  run(database, 'delete from folders where id = ?', [id])
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return true
}

async function createDocument(input: CreateDocInput) {
  const database = await ensureDb()
  run(database, 'insert into documents (folder_id, title, content) values (?, ?, ?)', [
    input.folderId,
    input.title,
    input.content ?? '',
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  const doc = row?.id ? await getDocument(Number(row.id)) : null
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return doc
}

async function renameDocument(input: RenameDocInput) {
  const database = await ensureDb()
  run(database, 'update documents set title = ?, updated_at = datetime(\'now\') where id = ?', [
    input.title,
    input.id,
  ])
  const doc = await getDocument(input.id)
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return doc
}

async function deleteDocument(id: number) {
  const database = await ensureDb()
  run(database, 'delete from documents where id = ?', [id])
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return true
}

async function listTemplates(): Promise<TemplateRow[]> {
  const database = await ensureDb()
  return all<TemplateRow>(
    database,
    'select id, name, content, updated_at as updatedAt from templates order by updated_at desc'
  )
}

async function createTemplate(input: CreateTemplateInput) {
  const database = await ensureDb()
  run(database, 'insert into templates (name, content, updated_at) values (?, ?, datetime(\'now\'))', [
    input.name,
    input.content,
  ])
  const row = get<{ id: number }>(database, 'select last_insert_rowid() as id')
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return Number(row?.id ?? 0)
}

async function updateTemplate(input: UpdateTemplateInput) {
  const database = await ensureDb()
  run(database, 'update templates set name = ?, content = ?, updated_at = datetime(\'now\') where id = ?', [
    input.name,
    input.content,
    input.id,
  ])
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return true
}

async function deleteTemplate(id: number) {
  const database = await ensureDb()
  run(database, 'delete from templates where id = ?', [id])
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return true
}

export async function importTemplates(items: Array<{ name: string; content: string }>) {
  const database = await ensureDb()
  items.forEach((item) => {
    run(database, 'insert into templates (name, content, updated_at) values (?, ?, datetime(\'now\'))', [
      item.name,
      item.content,
    ])
  })
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return true
}

async function applyTemplate(payload: { templateId: number; docId: number }) {
  const database = await ensureDb()
  const template = get<{ content: string }>(database, 'select content from templates where id = ?', [payload.templateId])
  if (!template) return null
  run(database, 'update documents set content = ?, updated_at = datetime(\'now\') where id = ?', [
    template.content,
    payload.docId,
  ])
  const doc = await getDocument(payload.docId)
  const dbPath = path.join(app.getPath('userData'), 'word-tool.sqlite')
  saveDb(database, dbPath)
  return doc
}

export function registerDbIpc() {
  ipcMain.handle('db:init', async () => {
    await ensureDb()
    return true
  })

  ipcMain.handle('db:list-folders', async () => listFolders())
  ipcMain.handle('db:list-docs', async (_event, folderId: number | null) => listDocuments(folderId))
  ipcMain.handle('db:get-doc', async (_event, id: number) => getDocument(id))
  ipcMain.handle('db:save-doc', async (_event, input: { id: number; title: string; content: string }) => saveDocument(input))
  ipcMain.handle('db:create-folder', async (_event, input: CreateFolderInput) => createFolder(input))
  ipcMain.handle('db:rename-folder', async (_event, input: RenameFolderInput) => renameFolder(input))
  ipcMain.handle('db:delete-folder', async (_event, id: number) => deleteFolder(id))
  ipcMain.handle('db:create-doc', async (_event, input: CreateDocInput) => createDocument(input))
  ipcMain.handle('db:rename-doc', async (_event, input: RenameDocInput) => renameDocument(input))
  ipcMain.handle('db:delete-doc', async (_event, id: number) => deleteDocument(id))
  ipcMain.handle('db:list-templates', async () => listTemplates())
  ipcMain.handle('db:create-template', async (_event, input: CreateTemplateInput) => createTemplate(input))
  ipcMain.handle('db:update-template', async (_event, input: UpdateTemplateInput) => updateTemplate(input))
  ipcMain.handle('db:delete-template', async (_event, id: number) => deleteTemplate(id))
  ipcMain.handle('db:apply-template', async (_event, payload: { templateId: number; docId: number }) =>
    applyTemplate(payload)
  )
}
