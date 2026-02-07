import type { MenuState } from '../../types'

type Props = {
  menu: MenuState | null
  submenuOpen: boolean
  onSubmenuOpen: (open: boolean) => void
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onCreateBlank: () => void
  onCreateFromTemplate: () => void
  onCreateFolder: () => void
  disableActions: boolean
}

const DocFolderMenu = ({
  menu,
  submenuOpen,
  onSubmenuOpen,
  onClose,
  onRename,
  onDelete,
  onCreateBlank,
  onCreateFromTemplate,
  onCreateFolder,
  disableActions,
}: Props) => {
  if (!menu) return null
  const showSubmenu = submenuOpen || menu.mode === 'submenu'
  return (
    <>
      <div className='menu-backdrop' onClick={onClose} />
      <div
        className='menu-stack'
        style={{ top: menu.y, left: menu.x }}
        onMouseLeave={() => onSubmenuOpen(false)}
        onClick={(event) => event.stopPropagation()}
      >
        {menu.mode !== 'submenu' ? (
          <div className='menu main'>
            <button className='menu-item with-arrow' onMouseEnter={() => onSubmenuOpen(true)}>
              <span>新建</span>
              <span className='menu-arrow'>›</span>
            </button>
            <div className='menu-divider' />
            <button className='menu-item' disabled={disableActions} onClick={onRename}>
              重命名
            </button>
            <button className='menu-item danger' disabled={disableActions} onClick={onDelete}>
              删除
            </button>
          </div>
        ) : null}
        {showSubmenu ? (
          <div className='menu submenu' onMouseEnter={() => onSubmenuOpen(true)}>
            <button className='menu-item' onClick={onCreateBlank}>空白文档</button>
            <button className='menu-item' onClick={onCreateFromTemplate}>从模板新建</button>
            <button className='menu-item' onClick={onCreateFolder}>文件夹</button>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default DocFolderMenu
