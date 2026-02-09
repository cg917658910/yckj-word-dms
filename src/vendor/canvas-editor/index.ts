export type CanvasEditorBlock = {
  value: string
}

export type CanvasEditorOptions = {
  main: CanvasEditorBlock[]
  placeholder?: string
  onChange?: (main: CanvasEditorBlock[], html: string) => void
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')

const TOOLBAR_ITEMS = [
  { label: 'B', command: 'bold', title: '加粗' },
  { label: 'I', command: 'italic', title: '斜体' },
  { label: 'U', command: 'underline', title: '下划线' },
  { label: 'S', command: 'strikeThrough', title: '删除线' },
  { label: '左', command: 'justifyLeft', title: '左对齐' },
  { label: '中', command: 'justifyCenter', title: '居中' },
  { label: '右', command: 'justifyRight', title: '右对齐' },
]

class Editor {
  private root: HTMLElement
  private options: CanvasEditorOptions
  private inputEl: HTMLDivElement
  private main: CanvasEditorBlock[]
  private toolbarEl: HTMLDivElement

  constructor(root: HTMLElement, options: CanvasEditorOptions) {
    this.root = root
    this.options = options
    this.main = options.main
    this.inputEl = document.createElement('div')
    this.inputEl.className = 'canvas-editor__input'
    this.inputEl.contentEditable = 'true'
    this.inputEl.spellcheck = false
    this.inputEl.dataset.placeholder = options.placeholder ?? ''
    this.inputEl.addEventListener('input', this.handleInput)
    this.inputEl.addEventListener('blur', this.handleInput)

    this.toolbarEl = document.createElement('div')
    this.toolbarEl.className = 'canvas-editor__toolbar'
    this.toolbarEl.append(...this.createToolbarButtons())

    const container = document.createElement('div')
    container.className = 'canvas-editor__container'
    container.appendChild(this.toolbarEl)
    container.appendChild(this.inputEl)
    this.root.replaceChildren(container)
    this.render()
  }

  private createToolbarButtons() {
    return TOOLBAR_ITEMS.map((item) => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'canvas-editor__tool'
      button.textContent = item.label
      button.title = item.title
      button.addEventListener('click', () => {
        document.execCommand(item.command)
        this.handleInput()
      })
      return button
    })
  }

  private handleInput = () => {
    const html = this.inputEl.innerHTML.trim()
    this.main = [{ value: html }]
    this.options.onChange?.(this.main, this.getHTML())
  }

  private render() {
    const html = this.main.length ? this.main.map((block) => block.value).join('') : ''
    this.inputEl.innerHTML = html
  }

  setData(main: CanvasEditorBlock[]) {
    this.main = main
    this.render()
  }

  getHTML() {
    if (this.main.length === 0) return ''
    const html = this.main.map((block) => block.value).join('')
    if (html.trim()) return html
    return `<p>${escapeHtml(this.inputEl.innerText)}</p>`
  }

  destroy() {
    this.inputEl.removeEventListener('input', this.handleInput)
    this.inputEl.removeEventListener('blur', this.handleInput)
    this.root.replaceChildren()
  }
}

export default Editor
