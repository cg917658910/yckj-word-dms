import 'ckeditor5/ckeditor5.css'

import {
  Alignment,
  Autoformat,
  BlockQuote,
  Bold,
  ClassicEditor,
  Essentials,
  FontColor,
  FontSize,
  Heading,
  Indent,
  IndentBlock,
  Italic,
  Link,
  List,
  Paragraph,
  Table,
  TableToolbar,
  Underline
} from 'ckeditor5'

import coreTranslations from 'ckeditor5/translations/zh-cn.js'

export const EDITOR_CONFIG = {
  plugins: [
    Autoformat,
    BlockQuote,
    Bold,
    Essentials,
    FontColor,
    FontSize,
    Heading,
    Alignment,
    Indent,
    IndentBlock,
    Italic,
    Link,
    List,
    Paragraph,
    /* PasteFromOffice */,
    Table,
    TableToolbar,
    Underline,
  ],
  licenseKey: 'GPL',
  language: 'zh-cn',
  translations: [coreTranslations],
  toolbar: [
    'undo',
    'redo',
    '|',
    'heading',
    '|',
    'fontSize',
    'fontColor',
    '|',
    'bold',
    'italic',
    'underline',
    '|',
    'alignment',
    '|',
    'link',
    'insertTable',
    'blockQuote',
    '|',
    'bulletedList',
    'numberedList',
    '|',
    'outdent',
    'indent',
  ],
  heading: {
    options: [
      { model: 'paragraph', title: '正文', class: 'ck-heading_paragraph' },
      { model: 'heading1', view: 'h1', title: '标题 1', class: 'ck-heading_heading1' },
      { model: 'heading2', view: 'h2', title: '标题 2', class: 'ck-heading_heading2' },
      { model: 'heading3', view: 'h3', title: '标题 3', class: 'ck-heading_heading3' },
      { model: 'heading4', view: 'h4', title: '标题 4', class: 'ck-heading_heading4' },
    ],
  },
  alignment: {
    options: ['left', 'center', 'right', 'justify'],
  },
  fontSize: {
    options: [10, 12, 14, 16, 18, 20, 24, 28, 32],
  },
  table: {
    contentToolbar: ['tableColumn', 'tableRow', 'mergeTableCells'],
  },
} as const

export default ClassicEditor
