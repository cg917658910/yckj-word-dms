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

  const sortTree = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder
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
  const text = stripHtml(detail.content || '')
  return {
    id: detail.id,
    folderId: detail.folderId ?? null,
    title: detail.title,
    snippet: text.slice(0, 120),
    updatedAt: detail.updatedAt,
    size: (detail.content || '').length,
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
    size: (template.content || '').length,
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
