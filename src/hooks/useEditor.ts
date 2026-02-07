import { useEffect, useRef, useState } from 'react'

export type UseEditorOptions = {
  onSave: () => void
}

export const useEditor = ({ onSave }: UseEditorOptions) => {
  const editorRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const suppressSelectionRef = useRef(false)
  const [lineHeight, setLineHeight] = useState('1.9')

  useEffect(() => {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand('defaultParagraphSeparator', false, 'p')
  }, [])

  useEffect(() => {
    const handleSelectionChange = () => {
      if (suppressSelectionRef.current) return
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) return
      const range = selection.getRangeAt(0)
      const container = editorRef.current
      if (!container) return
      if (container.contains(range.startContainer) && container.contains(range.endContainer)) {
        savedRangeRef.current = range.cloneRange()
      }
    }
    document.addEventListener('selectionchange', handleSelectionChange)
    return () => document.removeEventListener('selectionchange', handleSelectionChange)
  }, [])

  const captureSelection = () => {
    const selection = window.getSelection()
    const container = editorRef.current
    if (!selection || selection.rangeCount === 0 || !container) return
    const range = selection.getRangeAt(0)
    if (container.contains(range.startContainer) && container.contains(range.endContainer)) {
      savedRangeRef.current = range.cloneRange()
    }
  }

  const restoreSelection = () => {
    const range = savedRangeRef.current
    const selection = window.getSelection()
    if (!range || !selection) return
    selection.removeAllRanges()
    selection.addRange(range)
  }

  const applyCommand = (command: string, value?: string) => {
    editorRef.current?.focus()
    restoreSelection()
    document.execCommand(command, false, value)
  }

  const applyWithSelection = (fn: () => void) => {
    editorRef.current?.focus()
    restoreSelection()
    fn()
    captureSelection()
  }

  const getSelectedBlocks = () => {
    const container = editorRef.current
    const selection = window.getSelection()
    if (!container || !selection || selection.rangeCount === 0) return []
    const range = selection.getRangeAt(0)
    const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'blockquote', 'li'])
    const nodes = new Set<HTMLElement>()
    const walker = document.createTreeWalker(
      container,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          if (!(node instanceof HTMLElement)) return NodeFilter.FILTER_REJECT
          const tag = node.tagName.toLowerCase()
          return blockTags.has(tag) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP
        },
      },
    )
    while (walker.nextNode()) {
      const el = walker.currentNode as HTMLElement
      if (range.intersectsNode(el)) nodes.add(el)
    }
    if (!nodes.size) {
      let el = selection.focusNode instanceof HTMLElement
        ? selection.focusNode
        : selection.focusNode?.parentElement
      if (!el) {
        el = selection.anchorNode instanceof HTMLElement
          ? selection.anchorNode
          : selection.anchorNode?.parentElement
      }
      if (el === container) {
        el = container.firstElementChild as HTMLElement | null
      }
      while (el && el !== container && !blockTags.has(el.tagName.toLowerCase())) {
        el = el.parentElement
      }
      if (el && el !== container) nodes.add(el)
    }
    return Array.from(nodes)
  }

  const ensureBlocks = () => {
    let blocks = getSelectedBlocks()
    if (!blocks.length) {
      applyCommand('formatBlock', 'p')
      blocks = getSelectedBlocks()
    }
    return blocks
  }

  const applyBlockStyle = (style: 'textAlign' | 'lineHeight', value: string) => {
    const blocks = ensureBlocks()
    blocks.forEach((block) => {
      if (style === 'textAlign') block.style.textAlign = value
      if (style === 'lineHeight') block.style.lineHeight = value
    })
    editorRef.current?.focus()
  }

  const adjustIndent = (delta: number) => {
    const blocks = ensureBlocks()
    blocks.forEach((block) => {
      const current = parseFloat(block.style.marginLeft || '0')
      const next = Math.max(0, current + delta)
      block.style.marginLeft = `${next}px`
    })
    editorRef.current?.focus()
  }

  const handleEditorKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      if (event.shiftKey) {
        adjustIndent(-24)
      } else {
        document.execCommand('insertHTML', false, '&nbsp;&nbsp;&nbsp;&nbsp;')
        editorRef.current?.focus()
      }
    }
  }

  const onSelectMouseDown = () => {
    suppressSelectionRef.current = true
    captureSelection()
    setTimeout(() => { suppressSelectionRef.current = false }, 0)
  }

  return {
    editorRef,
    lineHeight,
    setLineHeight,
    applyCommand,
    applyWithSelection,
    applyBlockStyle,
    adjustIndent,
    handleEditorKeyDown,
    captureSelection,
    onSelectMouseDown,
    onEditorMouseDown: () => { suppressSelectionRef.current = false },
    onEditorMouseUp: captureSelection,
    onEditorKeyUp: captureSelection,
    onEditorBlur: onSave,
  }
}
