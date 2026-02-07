import type { MenuState } from '../../types'

type Props = {
  menu: MenuState | null
  submenuOpen: boolean
  onSubmenuOpen: (open: boolean) => void
  onClose: () => void
  onRename: () => void
  onDelete: () => void
  onUploadFiles: () => void
  onUploadFolder: () => void
  onCreateBlank: () => void
  onCreateFolder: () => void
  disableActions: boolean
}

const TemplateFolderMenu = ({
  menu,
  submenuOpen,
  onSubmenuOpen,
  onClose,
  onRename,
  onDelete,
  onUploadFiles,
  onUploadFolder,
  onCreateBlank,
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
            <div className='menu-divider' />
            <button className='menu-item' onClick={onUploadFiles}>上传文件</button>
            <button className='menu-item' onClick={onUploadFolder}>上传文件夹</button>
            <button className='menu-item danger' disabled={disableActions} onClick={onDelete}>
              删除
            </button>
          </div>
        ) : null}
        {showSubmenu ? (
          <div className='menu submenu' onMouseEnter={() => onSubmenuOpen(true)}>
            <button className='menu-item' onClick={onCreateBlank}>空白模板</button>
            <button className='menu-item' onClick={onCreateFolder}>文件夹</button>
          </div>
        ) : null}
      </div>
    </>
  )
}

export default TemplateFolderMenu
