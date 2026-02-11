import type { DocDetail, DocSummary, FolderNode, FolderRow, TemplateRow } from '../types'

export const buildTree = (rows: FolderRow[], docs: DocSummary[]): FolderNode[] => {
  const map = new Map<number, FolderNode>()
  const roots: FolderNode[] = []
  const docsByFolder = new Map<number | null, DocSummary[]>()

  docs.forEach((doc) => {
    const list = docsByFolder.get(doc.folderId ?? null) ?? []
    list.push(doc)
    docsByFolder.set(doc.folderId ?? null, list)
  })

  rows.forEach((row) => {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      parentId: row.parentId,
      sortOrder: row.sortOrder,
      children: [],
      docs: [],
    })
  })

  rows.forEach((row) => {
    const node = map.get(row.id)
    if (!node) return
    if (row.parentId) {
      const parent = map.get(row.parentId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  })

  rows.forEach((row) => {
    const node = map.get(row.id)
    if (!node) return
    node.docs = docsByFolder.get(row.id) ?? []
  })

  const alphaFirst = (value: string) => (/^[A-Za-z]/.test(value) ? 0 : 1)

  const sortTree = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => {
      const wa = alphaFirst(a.name)
      const wb = alphaFirst(b.name)
      if (wa !== wb) return wa - wb
      return a.name.localeCompare(b.name, 'zh-CN')
    })
    nodes.forEach((child) => sortTree(child.children))
  }
  sortTree(roots)

  return roots
}

export const stripHtml = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const toDocSummary = (detail: DocDetail): DocSummary => {
  return {
    id: detail.id,
    folderId: detail.folderId ?? null,
    title: detail.title,
    snippet: '',
    updatedAt: detail.updatedAt,
    size: detail.size,
    filePath: detail.filePath ?? null,
  }
}

export const toTemplateSummary = (template: TemplateRow): DocSummary => {
  const text = stripHtml(template.content || '')
  return {
    id: template.id,
    folderId: template.folderId ?? null,
    title: template.name,
    snippet: text.slice(0, 120),
    updatedAt: template.updatedAt,
    size: template.size ?? (template.content || '').length,
    filePath: template.filePath ?? null,
  }
}

export const collectDescendantIds = (rows: FolderRow[], rootId: number) => {
  const ids = new Set<number>([rootId])
  let changed = true
  while (changed) {
    changed = false
    rows.forEach((row) => {
      if (row.parentId !== null && ids.has(row.parentId) && !ids.has(row.id)) {
        ids.add(row.id)
        changed = true
      }
    })
  }
  return ids
}

export const collectDescendantsOnly = (rows: FolderRow[], rootId: number) => {
  const ids = collectDescendantIds(rows, rootId)
  ids.delete(rootId)
  return ids
}
