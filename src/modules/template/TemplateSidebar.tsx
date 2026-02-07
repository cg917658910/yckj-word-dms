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
  activeTemplateId: number | null
  onRootClick: () => void
  onRootContextMenu: (event: MouseEvent) => void
  onToggleFolder: (id: number) => void
  onFolderMenu: (id: number, x: number, y: number) => void
  onSelectTemplate: (id: number) => void
  onTemplateMenu: (menu: DocMenuState) => void
}

const TemplateSidebar = ({
  nodes,
  rootActive,
  rootDocs,
  selectedFolderId,
  collapsed,
  hoverId,
  setHoverId,
  activeTemplateId,
  onRootClick,
  onRootContextMenu,
  onToggleFolder,
  onFolderMenu,
  onSelectTemplate,
  onTemplateMenu,
}: Props) => (
  <TreeView
    nodes={nodes}
    rootLabel='全部模板'
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
    onSelectDoc={onSelectTemplate}
    activeDocId={activeTemplateId}
    onDocMenu={(id, x, y) => onTemplateMenu({ docId: id, x, y })}
  />
)

export default TemplateSidebar

