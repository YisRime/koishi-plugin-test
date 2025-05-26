/**
 * 主题配置接口
 */
export interface ThemeConfig {
  /** 颜色配置 */
  colors: Record<string, string>
  /** 字体排版配置 */
  typography: { fontFamily: string; fontSize: number; titleSize: number; titleWeight: string; lineHeight: number }
  /** 间距配置 */
  spacing: { itemPadding: string; itemSpacing: number; containerPadding: string }
  /** 视觉效果配置 */
  effects: { shadow: string; backdropBlur: number; enableGlass: boolean }
  /** 外边距 */
  outerPadding: number
  /** 内边距 */
  innerPadding: number
  /** 背景图片URL */
  backgroundImage: string
  /** 边框圆角 */
  borderRadius: string
  /** 字体URL */
  fontUrl?: string
  /** 页头配置 */
  header: { show: boolean; text: string }
  /** 页脚配置 */
  footer: { show: boolean; text: string }
}

/**
 * 布局配置接口
 */
export interface LayoutConfig {
  /** 网格行数 */
  rows: number
  /** 网格列数 */
  cols: number
  /** 网格项目数组 */
  items: GridItem[]
}

/**
 * 网格项目接口
 */
export interface GridItem {
  /** 行位置 */
  row: number
  /** 列位置 */
  col: number
  /** 行跨度 */
  rowSpan: number
  /** 列跨度 */
  colSpan: number
  /** 内容类型 */
  type: 'text' | 'image'
  /** 项目内容 */
  content: string
  /** 项目标题 */
  title: string
  /** 图标名称 */
  icon: string
  /** 图标类型 */
  iconType: 'material'
  /** 徽章内容 */
  badge?: string | number
  /** 项目ID */
  id: string
  /** 项目类型 */
  itemType: 'command' | 'subCommand' | 'option' | 'title' | 'header'
}

/**
 * 主题渲染器 - 负责将主题配置和布局配置转换为HTML
 */
export class ThemeRenderer {
  /**
   * 生成完整的HTML文档
   * @param theme 主题配置对象
   * @param layout 布局配置对象
   * @returns 完整的HTML字符串
   */
  generateHtml(theme: ThemeConfig, layout: LayoutConfig): string {
    const glassEffect = theme.effects.enableGlass ? `backdrop-filter:blur(${theme.effects.backdropBlur}px);-webkit-backdrop-filter:blur(${theme.effects.backdropBlur}px);` : ''
    const bg = theme.backgroundImage ? `background:url('${theme.backgroundImage}') center/cover;` : `background:${theme.colors.background};`

    const css = this.generateCSS(theme, glassEffect, bg)
    const body = this.generateBody(theme, layout, glassEffect)

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`
  }

  /**
   * 生成CSS样式
   * @param theme 主题配置
   * @param glassEffect 毛玻璃效果CSS
   * @param bg 背景CSS
   * @returns CSS字符串
   */
  private generateCSS(theme: ThemeConfig, glassEffect: string, bg: string): string {
    return `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');${theme.fontUrl ? `\n@import url('${theme.fontUrl}');` : ''}
*{box-sizing:border-box;margin:0;padding:0}
body{font:${theme.typography.fontSize}px/${theme.typography.lineHeight} ${theme.typography.fontFamily};color:${theme.colors.text};${bg}-webkit-font-smoothing:antialiased;padding:${theme.outerPadding}px}
.container{max-width:fit-content;min-width:320px;padding:${theme.spacing.containerPadding};border-radius:${theme.borderRadius};background:${theme.colors.surface};box-shadow:${theme.effects.shadow};margin:0 auto;${glassEffect}}
.grid-container{display:grid;width:100%;gap:${theme.spacing.itemSpacing}px;grid-template:repeat(var(--grid-rows),auto)/repeat(var(--grid-cols),1fr);margin-bottom:${theme.innerPadding}px}
.grid-container:last-child{margin-bottom:0}
.header,.footer{border-radius:${theme.borderRadius};width:100%;${glassEffect.replace(theme.effects.backdropBlur.toString(), (theme.effects.backdropBlur * 0.6).toString())}}
.header{background:linear-gradient(135deg,${theme.colors.surface},${theme.colors.background});color:${theme.colors.text};padding:${theme.spacing.itemPadding};text-align:center;border:1px solid ${theme.colors.border};box-shadow:${theme.effects.shadow};font-weight:600;margin-bottom:${theme.innerPadding}px}
.footer{background:${theme.colors.surface};color:${theme.colors.textSecondary};font-size:13px;padding:16px;border:1px solid ${theme.colors.border};box-shadow:${theme.effects.shadow};opacity:0.7;font-weight:500;text-align:center}
.grid-item{background:${theme.colors.surface};padding:${theme.spacing.itemPadding};border-radius:${theme.borderRadius};border:1px solid ${theme.colors.border};box-shadow:${theme.effects.shadow};overflow:hidden;min-width:200px;position:relative;${glassEffect.replace(theme.effects.backdropBlur.toString(), (theme.effects.backdropBlur * 0.6).toString())}}
.grid-item-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.grid-item-title{font-weight:${theme.typography.titleWeight};font-size:${theme.typography.titleSize}em;margin:0;color:${theme.colors.primary};letter-spacing:-0.02em}
.grid-item-icon{color:${theme.colors.primary};font-size:22px;font-family:'Material Icons Round';margin-right:10px;opacity:0.8}
.grid-item-content{line-height:${theme.typography.lineHeight};color:${theme.colors.textSecondary};white-space:pre-wrap;font-size:0.95em}
.grid-item-badge{position:absolute;top:-8px;right:-8px;background:${theme.colors.accent};color:${theme.colors.surface};border-radius:16px;padding:4px 10px;font-size:0.7em;font-weight:700;box-shadow:${theme.effects.shadow};letter-spacing:0.5px}
.grid-item.subCommand::before,.grid-item.option::before{content:'';position:absolute;left:0;top:0;bottom:0;width:4px;border-radius:0 ${theme.borderRadius} ${theme.borderRadius} 0}
.grid-item.subCommand::before{background:linear-gradient(180deg,${theme.colors.secondary},${theme.colors.primary})}
.grid-item.option::before{background:linear-gradient(180deg,${theme.colors.accent},${theme.colors.secondary})}
.grid-item.title .grid-item-title{font-size:1.4em;text-align:center;font-weight:700;letter-spacing:-0.03em}
.grid-item.title{background:linear-gradient(135deg,${theme.colors.primary}12,${theme.colors.secondary}08);border:2px solid ${theme.colors.primary}20}
.grid-item.command{background:linear-gradient(135deg,${theme.colors.surface},${theme.colors.background})}`
  }

  /**
   * 生成页面主体内容
   * @param theme 主题配置
   * @param layout 布局配置
   * @param glassEffect 毛玻璃效果CSS
   * @returns HTML主体字符串
   */
  private generateBody(theme: ThemeConfig, layout: LayoutConfig, glassEffect: string): string {
    const grid = layout.items.map(item => {
      const icon = item.icon ? `<span class="grid-item-icon">${item.icon}</span>` : ''
      const badge = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : ''
      const title = item.title ? `<h3 class="grid-item-title">${this.escape(item.title)}</h3>` : ''
      const content = item.type === 'image' ? `<img src="${item.content}" style="max-width:100%;border-radius:4px">` : `<div class="grid-item-content">${this.escape(item.content)}</div>`

      return `<div class="grid-item${item.itemType ? ` ${item.itemType}` : ''}"${item.id ? ` id="${item.id}"` : ''} style="grid-area:${item.row}/${item.col}/span ${item.rowSpan || 1}/span ${item.colSpan || 1}"><div class="grid-item-header">${icon}${badge}</div>${title}${content}</div>`
    }).join('')

    return `<div class="container" style="--grid-rows:${layout.rows};--grid-cols:${layout.cols}">${theme.header.show ? `<div class="header">${this.escape(theme.header.text)}</div>` : ''}<div class="grid-container">${grid}</div>${theme.footer.show ? `<div class="footer">${this.escape(theme.footer.text)}</div>` : ''}</div>`
  }

  /**
   * HTML转义函数
   * @param value 需要转义的值
   * @returns 转义后的字符串
   */
  private escape(value: any): string {
    return String(value || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' })[m])
  }
}
