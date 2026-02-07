import type { CSSProperties, MouseEvent } from 'react'
import type { FolderNode } from '../types'

type Props = {
  nodes: FolderNode[]
  rootLabel: string
  rootActive: boolean
  onRootClick: () => void
  onRootContextMenu?: (event: MouseEvent<HTMLButtonElement>) => void
  selectedFolderId: number | null | undefined
  collapsed: Set<number>
  onToggle: (id: number) => void
  onFolderMenu: (id: number, x: number, y: number) => void
  hoverId: number | null
  setHoverId: (id: number | null) => void
  onSelectDoc: (id: number) => void
  activeDocId: number | null
  onDocMenu: (id: number, x: number, y: number) => void
}

const renderTree = (
  nodes: FolderNode[],
  depth: number,
  selectedId: number | null | undefined,
  collapsed: Set<number>,
  onToggle: (id: number) => void,
  onMenu: (id: number, x: number, y: number) => void,
  hoverId: number | null,
  setHoverId: (id: number | null) => void,
  onSelectDoc: (id: number) => void,
  activeDocId: number | null,
  onDocMenu: (id: number, x: number, y: number) => void,
) =>
  nodes.map((node) => {
    const hasToggle = node.children.length || node.docs.length
    return (
      <div key={`${node.id}-${depth}`} className='tree-node' style={{ '--depth': depth } as CSSProperties}>
        <div
          className='tree-row-wrap'
          onMouseEnter={() => setHoverId(node.id)}
          onMouseLeave={() => setHoverId(null)}
          onContextMenu={(event) => {
            event.preventDefault()
            onMenu(node.id, event.clientX, event.clientY)
          }}
        >
          <button
            className={`tree-row ${selectedId === node.id ? 'active' : ''}`}
            onClick={() => {
              if (hasToggle) onToggle(node.id)
            }}
          >
            {hasToggle ? (
              <span
                className='tree-toggle'
                onClick={(event) => {
                  event.stopPropagation()
                  onToggle(node.id)
                }}
              >
                {collapsed.has(node.id) ? '+' : '-'}
              </span>
            ) : (
              <span />
            )}
            <span className='tree-icon' />
            <span className='tree-name'>{node.name}</span>
          </button>
        </div>
        {node.children.length && !collapsed.has(node.id) ? (
          <div className='tree-children'>
            {renderTree(
              node.children,
              depth + 1,
              selectedId,
              collapsed,
              onToggle,
              onMenu,
              hoverId,
              setHoverId,
              onSelectDoc,
              activeDocId,
              onDocMenu,
            )}
          </div>
        ) : null}
        {!collapsed.has(node.id) && node.docs.length ? (
          <div className='tree-docs'>
            {node.docs.map((doc) => (
              <button
                key={doc.id}
                className={`tree-doc ${activeDocId === doc.id ? 'active' : ''}`}
                onClick={() => onSelectDoc(doc.id)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  onDocMenu(doc.id, event.clientX, event.clientY)
                }}
              >
                <span className='doc-icon small' />
                <span className='tree-doc-title'>{doc.title}</span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  })

const TreeView = ({
  nodes,
  rootLabel,
  rootActive,
  onRootClick,
  onRootContextMenu,
  selectedFolderId,
  collapsed,
  onToggle,
  onFolderMenu,
  hoverId,
  setHoverId,
  onSelectDoc,
  activeDocId,
  onDocMenu,
}: Props) => (
  <div className='tree'>
    <button
      className={`tree-row ${rootActive ? 'active' : ''}`}
      onClick={onRootClick}
      onContextMenu={onRootContextMenu}
    >
      <span className='tree-dot' />
      <span className='tree-icon' />
      <span className='tree-name'>{rootLabel}</span>
    </button>
    {renderTree(
      nodes,
      0,
      selectedFolderId,
      collapsed,
      onToggle,
      onFolderMenu,
      hoverId,
      setHoverId,
      onSelectDoc,
      activeDocId,
      onDocMenu,
    )}
  </div>
)

export default TreeView
