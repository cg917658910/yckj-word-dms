import type { ReactNode } from 'react'
import type { DocSummary } from '../../types'

type Props = {
  open: boolean
  onClose: () => void
  findQuery: string
  replaceQuery: string
  setFindQuery: (value: string) => void
  setReplaceQuery: (value: string) => void
  findCommitQuery: string
  setFindCommitQuery: (value: string) => void
  matchedDocs: DocSummary[]
  onExecute: () => void
  highlight: (text: string, query: string) => ReactNode
}

const FindReplacePanel = ({
  open,
  onClose,
  findQuery,
  replaceQuery,
  setFindQuery,
  setReplaceQuery,
  findCommitQuery,
  setFindCommitQuery,
  matchedDocs,
  onExecute,
  highlight,
}: Props) => {
  if (!open) return null
  return (
    <div className='panel-backdrop' onClick={onClose}>
      <div className='panel editor-panel' onClick={(event) => event.stopPropagation()}>
        <div className='panel-header'>
          <div className='panel-title'>查找替换</div>
          <button className='ghost' onClick={onClose}>关闭</button>
        </div>
        <div className='panel-body'>
          <label className='panel-field'>
            <span>查找内容</span>
            <input
              value={findQuery}
              onChange={(event) => setFindQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  setFindCommitQuery(findQuery)
                }
              }}
              placeholder='回车执行查找'
            />
          </label>
          <label className='panel-field'>
            <span>替换为</span>
            <input value={replaceQuery} onChange={(event) => setReplaceQuery(event.target.value)} />
          </label>
          <div className='panel-hint'>范围：当前文件夹（全部文档时为全库）</div>
          {findCommitQuery.trim() ? (
            <div className='panel-results'>
              <div className='panel-hint'>匹配到 {matchedDocs.length} 篇文档</div>
              <div className='panel-result-list'>
                {matchedDocs.map((doc) => (
                  <div key={doc.id} className='panel-result'>
                    <div className='panel-result-title'>{highlight(doc.title, findCommitQuery)}</div>
                    <div className='panel-result-snippet'>{highlight(doc.snippet || '暂无摘要', findCommitQuery)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
        <div className='panel-footer'>
          <button className='ghost' onClick={onClose}>取消</button>
          <button
            className='primary'
            disabled={!findQuery.trim()}
            onClick={onExecute}
          >
            执行替换
          </button>
        </div>
      </div>
    </div>
  )
}

export default FindReplacePanel
