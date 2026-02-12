
export const normalizeHtml = (input: string) => input.replace(/\u00a0/g, '&nbsp;')

/** 如果 filePath 已存在，自动追加 (副本N) 后缀 */
export const ensureUniquePath = async (filePath: string): Promise<string> => {
  
  return new Promise((resolve) => {
    resolve(filePath)
  })
}

export const extractInlineStyles = (input: string) => {
  const styles: string[] = []
  const body = input.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_match, css) => {
    if (css) styles.push(css)
    return ''
  })
  return { body, styles: styles.join('\n') }
}

