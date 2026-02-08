import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

export type MoveOption = {
  id: number | null
  label: ReactNode
  parentId?: number | null
}

type Props = {
  open: boolean
  title: string
  options: MoveOption[]
  value: number | null
  onChange: (value: number | null) => void
  onCancel: () => void
  onConfirm: () => void
}

const MovePanel = ({ open, title, options, value, onChange, onCancel, onConfirm }: Props) => {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return options
    const keyword = search.trim().toLowerCase()
    return options.filter((n) => String(n.label).toLowerCase().includes(keyword))
  }, [options, search])

  if (!open) return null

  return (
    <div className='panel-backdrop' onClick={onCancel}>
      <div className='panel' style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className='panel-header'>
          <div className='panel-title'>{title}</div>
          <button className='ghost small' onClick={onCancel}>✕</button>
        </div>

        {options.length > 5 && (
          <div className='move-search'>
            <input
              type='text'
              placeholder='搜索文件夹...'
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
          </div>
        )}

        <div className='move-folder-list'>
          <button
            className={`move-folder-item${value === null ? ' active' : ''}`}
            onClick={() => onChange(null)}
          >
            <span className='move-folder-icon'>📁</span>
            <span className='move-folder-name'>根目录</span>
            {value === null && <span className='move-folder-check'>✓</span>}
          </button>

          {filtered.map((node) => (
            <button
              key={node.id}
              className={`move-folder-item${value === node.id ? ' active' : ''}`}
              onClick={() => onChange(node.id)}
            >
              <span className='move-folder-icon'>📁</span>
              <span className='move-folder-name'>{node.label}</span>
              {value === node.id && <span className='move-folder-check'>✓</span>}
            </button>
          ))}

          {filtered.length === 0 && options.length > 0 && (
            <div className='move-folder-empty'>未找到匹配的文件夹</div>
          )}
          {options.length === 0 && (
            <div className='move-folder-empty'>暂无文件夹，将移动到根目录</div>
          )}
        </div>

        <div className='panel-footer'>
          <button className='ghost' onClick={onCancel}>取消</button>
          <button className='primary' onClick={onConfirm}>确定移动</button>
        </div>
      </div>
    </div>
  )
}

export default MovePanel
