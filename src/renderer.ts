/**
 * 主题配置接口
 */
export interface Theme {
  colors: {
    primary: string
    secondary: string
    background: string
    surface: string
    text: string
    textSecondary: string
    border: string
  }
  font: {
    family: string
    size: number
    titleScale: number
  }
  space: {
    padding: number
    gap: number
  }
  effects: { glass: boolean }
  bgImage: string
  radius: string
  fontUrl?: string
  header: { show: boolean; content: string }
  footer: { show: boolean; content: string }
}

export interface Layout {
  rows: number
  cols: number
  items: Item[]
}

export interface Item {
  row: number
  col: number
  rowSpan: number
  colSpan: number
  type: 'text' | 'image'
  content: string
  title: string
  id: string
  itemType: 'command' | 'subCommand' | 'option' | 'title' | 'header'
}

/**
 * 主题渲染器
 */
export class Render {
  buildHtml(theme: Theme, layout: Layout): string {
    const css = this.buildCSS(theme)
    const body = this.buildBody(theme, layout)
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`
  }

  private buildCSS(theme: Theme): string {
    const toRgb = (hex: string) => {
      const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
      return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      } : { r: 0, g: 0, b: 0 };
    };

    const primary = toRgb(theme.colors.primary);
    const secondary = toRgb(theme.colors.secondary);
    const background = toRgb(theme.colors.background);
    const text = toRgb(theme.colors.text);

    return `
${theme.fontUrl ? `@import url('${theme.fontUrl}');` : ''}

:root {
  --primary: ${theme.colors.primary};
  --secondary: ${theme.colors.secondary};
  --bg: ${theme.colors.background};
  --surface: ${theme.colors.surface};
  --text: ${theme.colors.text};
  --text-light: ${theme.colors.textSecondary};
  --border: ${theme.colors.border};
  --radius: ${theme.radius};
  --spacing: ${theme.space.padding}px;
  --gap: ${theme.space.gap}px;
  --font: ${theme.font.family};
  --fs: ${theme.font.size}px;
  --title-scale: ${theme.font.titleScale};
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font: 400 var(--fs)/1.6 var(--font);
  color: var(--text);
  background: ${theme.bgImage
    ? `var(--bg) url('${theme.bgImage}') center/cover`
    : `linear-gradient(135deg, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.05) 0%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.03) 50%, var(--bg) 100%)`};
  padding: calc(var(--spacing) * 2);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

body::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background:
    radial-gradient(circle at 25% 25%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.04) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.03) 0%, transparent 50%);
  z-index: -1;
  pointer-events: none;
}

.container {
  width: 100%;
  max-width: 520px;
  background: rgba(255, 255, 255, 0.98);
  border-radius: calc(var(--radius) * 1.5);
  overflow: hidden;
  box-shadow:
    0 20px 40px rgba(0, 0, 0, 0.04),
    0 8px 20px rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.05),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border: 1px solid var(--border);
  position: relative;
}

.header {
  background: linear-gradient(135deg, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.8) 0%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.8) 100%);
  color: white;
  padding: calc(var(--spacing) * 1.5);
  text-align: center;
  font-weight: 600;
  font-size: calc(var(--fs) * var(--title-scale));
  position: relative;
  box-shadow: 0 4px 12px rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.08);
}

.header::after {
  content: '';
  position: absolute;
  bottom: -2px;
  left: 50%;
  transform: translateX(-50%);
  width: 60px;
  height: 2px;
  background: rgba(255, 255, 255, 0.8);
  border-radius: 1px;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols, 1), 1fr);
  gap: var(--gap);
  padding: var(--gap);
  background: linear-gradient(135deg, rgba(${background.r}, ${background.g}, ${background.b}, 0.3) 0%, rgba(255, 255, 255, 0.9) 100%);
  position: relative;
}

.grid-item {
  background: rgba(255, 255, 255, 0.95);
  border-radius: var(--radius);
  padding: var(--spacing);
  border: 1px solid var(--border);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.02),
    0 2px 6px rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.03);
  position: relative;
  z-index: 1;
  overflow: hidden;
}

.grid-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 100%;
  background: linear-gradient(180deg, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.6) 0%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.6) 100%);
  opacity: 0.6;
}

.grid-item-title {
  font-weight: 600;
  font-size: calc(var(--fs) * 1.15);
  color: var(--text);
  margin-bottom: calc(var(--spacing) * 0.5);
  background: linear-gradient(90deg, var(--primary), var(--secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.grid-item-content {
  color: var(--text-light);
  white-space: pre-wrap;
  line-height: 1.6;
}

.grid-item.title {
  background: linear-gradient(135deg, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.8) 0%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.8) 100%);
  color: white;
  grid-column: 1 / -1;
  text-align: center;
  border: none;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.06),
    0 4px 12px rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.12);
}

.grid-item.title::before {
  display: none;
}

.grid-item.title .grid-item-title {
  color: white;
  font-size: calc(var(--fs) * var(--title-scale) * 1.1);
  -webkit-text-fill-color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.grid-item.header {
  background: linear-gradient(135deg, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.7) 0%, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.7) 100%);
  color: white;
  border: none;
  box-shadow:
    0 6px 16px rgba(0, 0, 0, 0.04),
    0 3px 8px rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.08);
}

.grid-item.header::before {
  background: rgba(255, 255, 255, 0.2);
}

.grid-item.header .grid-item-title,
.grid-item.header .grid-item-content {
  color: white;
  -webkit-text-fill-color: white;
}

.grid-item.option {
  border: 2px dashed var(--border);
  background: linear-gradient(145deg, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.02) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.grid-item.option::before {
  background: linear-gradient(180deg, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.3) 0%, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.3) 100%);
}

.grid-item.subCommand {
  background: linear-gradient(145deg, rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.03) 0%, rgba(255, 255, 255, 0.95) 100%);
  border-color: rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.15);
}

.grid-item.subCommand::before {
  background: rgba(${secondary.r}, ${secondary.g}, ${secondary.b}, 0.6);
}

.footer {
  background: linear-gradient(135deg, rgba(${background.r}, ${background.g}, ${background.b}, 0.6) 0%, rgba(255, 255, 255, 0.95) 100%);
  color: var(--text-light);
  padding: calc(var(--spacing) * 0.8);
  text-align: center;
  font-size: calc(var(--fs) * 0.85);
  border-top: 1px solid var(--border);
  position: relative;
}

.footer::before {
  content: '';
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 80px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(${primary.r}, ${primary.g}, ${primary.b}, 0.3), transparent);
  opacity: 0.4;
}

@media (max-width: 480px) {
  body {
    padding: var(--spacing);
  }
  .container {
    border-radius: var(--radius);
    max-width: 100%;
  }
  .grid-container { grid-template-columns: 1fr !important; }
}
`
  }

  private buildBody(theme: Theme, layout: Layout): string {
    const grid = layout.items.map(item => {
      const title = item.title ? `<div class="grid-item-title">${this.safeText(item.title)}</div>` : ''
      const content = item.type === 'image'
        ? `<img src="${item.content}" alt="${this.safeText(item.title)}" loading="lazy">`
        : `<div class="grid-item-content">${this.safeText(item.content)}</div>`

      return `<div class="grid-item ${item.itemType}" style="grid-column:${item.col}/span ${item.colSpan};grid-row:${item.row}/span ${item.rowSpan}">${title}${content}</div>`
    }).join('')

    return `<div class="container" style="--grid-cols:${layout.cols}">
      ${theme.header.show ? `<div class="header">${theme.header.content}</div>` : ''}
      <div class="grid-container">${grid}</div>
      ${theme.footer.show ? `<div class="footer">${theme.footer.content}</div>` : ''}
    </div>`
  }

  private safeText(str: string): string {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&lt;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m])
  }
}
