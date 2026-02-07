import type { MouseEvent } from 'react'
import TreeView from '../../components/TreeView'
import type { DocMenuState, DocSummary, FolderNode } from '../../types'

type Props = {
  nodes: FolderNode[]
  rootActive: boolean
  rootDocs: DocSummary[]
  selectedFolderId: number | null
  collapsed: Set<number>
  hoverId: number | null
  setHoverId: (value: number | null) => void
  activeDocId: number | null
  onRootClick: () => void
  onRootContextMenu: (event: MouseEvent) => void
  onToggleFolder: (id: number) => void
  onFolderMenu: (id: number, x: number, y: number) => void
  onSelectDoc: (id: number) => void
  onDocMenu: (menu: DocMenuState) => void
}

const DocSidebar = ({
  nodes,
  rootActive,
  rootDocs,
  selectedFolderId,
  collapsed,
  hoverId,
  setHoverId,
  activeDocId,
  onRootClick,
  onRootContextMenu,
  onToggleFolder,
  onFolderMenu,
  onSelectDoc,
  onDocMenu,
}: Props) => (
  <TreeView
    nodes={nodes}
    rootLabel='全部文档'
    rootActive={rootActive}
    onRootClick={onRootClick}
    onRootContextMenu={onRootContextMenu}
    rootDocs={rootDocs}
    selectedFolderId={selectedFolderId}
    collapsed={collapsed}
    onToggle={onToggleFolder}
    onFolderMenu={onFolderMenu}
    hoverId={hoverId}
    setHoverId={setHoverId}
    onSelectDoc={onSelectDoc}
    activeDocId={activeDocId}
    onDocMenu={(id, x, y) => onDocMenu({ docId: id, x, y })}
  />
)

export default DocSidebar


