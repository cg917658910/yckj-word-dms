import type { ReactNode } from 'react'

export type MoveOption = {
  id: number | null
  label: ReactNode
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
  if (!open) return null
  return (
    <div className='panel-backdrop'>
      <div className='panel'>
        <div className='panel-header'>
          <div className='panel-title'>{title}</div>
          <button className='ghost small' onClick={onCancel}>关闭</button>
        </div>
        <div className='panel-body'>
          <label className='panel-field'>
            选择目标文件夹
            <select
              value={value === null ? '' : String(value)}
              onChange={(event) => {
                const next = event.target.value
                onChange(next ? Number(next) : null)
              }}
            >
              <option value=''>根目录</option>
              {options.map((opt) => (
                <option key={opt.id ?? 'root'} value={opt.id ?? ''}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className='panel-footer'>
          <button className='ghost' onClick={onCancel}>取消</button>
          <button className='primary' onClick={onConfirm}>确定</button>
        </div>
      </div>
    </div>
  )
}

export default MovePanel
