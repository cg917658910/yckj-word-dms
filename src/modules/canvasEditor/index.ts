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

class CanvasEditor {
  private root: HTMLElement
  private options: CanvasEditorOptions
  private inputEl: HTMLDivElement
  private main: CanvasEditorBlock[]

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

    const container = document.createElement('div')
    container.className = 'canvas-editor__container'
    container.appendChild(this.inputEl)
    this.root.replaceChildren(container)
    this.render()
  }

  private handleInput = () => {
    const text = this.inputEl.innerText.replace(/\r/g, '').trimEnd()
    const lines = text ? text.split('\n') : ['']
    this.main = lines.map((line) => ({ value: line }))
    this.options.onChange?.(this.main, this.getHTML())
  }

  private render() {
    const text = this.main.map((block) => block.value).join('\n')
    this.inputEl.innerText = text
  }

  setData(main: CanvasEditorBlock[]) {
    this.main = main
    this.render()
  }

  getHTML() {
    return this.main.map((block) => `<p>${escapeHtml(block.value)}</p>`).join('')
  }

  destroy() {
    this.inputEl.removeEventListener('input', this.handleInput)
    this.root.replaceChildren()
  }
}

export default CanvasEditor
