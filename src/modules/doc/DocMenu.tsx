import type { DocMenuState } from '../../types'

type Props = {
  menu: DocMenuState | null
  onClose: () => void
  onRename: (docId: number) => Promise<void>
  onCopy: (docId: number) => Promise<void>
  onDelete: (docId: number) => Promise<void>
}

const DocMenu = ({
  menu,
  onClose,
  onRename,
  onCopy,
  onDelete,
}: Props) => {
  if (!menu) return null
  return (
    <>
      <div className='menu-backdrop' onClick={onClose} />
      <div className='menu doc-menu' style={{ top: menu.y, left: menu.x }}>
        <button
          className='menu-item'
          onClick={() => onRename(menu.docId)}
        >
          重命名
        </button>
        <button
          className='menu-item'
          onClick={() => onCopy(menu.docId)}
        >
          复制
        </button>
        <button
          className='menu-item danger'
          onClick={() => onDelete(menu.docId)}
        >
          删除
        </button>
      </div>
    </>
  )
}

export default DocMenu
