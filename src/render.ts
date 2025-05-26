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
  buildHtml(config: any, layout: Layout): string {
    const css = this.buildCSS(config)
    const body = this.buildBody(config, layout)
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`
  }

  private buildCSS(config: any): string {
    return `
${config.fontUrl ? `@import url('${config.fontUrl}');` : ''}

:root {
  --primary: ${config.primary};
  --secondary: ${config.secondary};
  --bg: ${config.bgColor};
  --surface: rgba(255, 255, 255, 0.96);
  --text: ${config.textColor};
  --text-light: rgba(100, 116, 139, 0.6);
  --border: rgba(139, 92, 246, 0.12);
  --radius: ${config.radius}px;
  --spacing: ${config.padding}px;
  --gap: ${Math.max(config.padding * 0.75, 10)}px;
  --font: system-ui, -apple-system, 'Segoe UI', sans-serif;
  --fs: ${config.fontSize}px;
  --title-scale: ${config.titleSize};
}

* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font: 400 var(--fs)/1.6 var(--font);
  color: var(--text);
  background: ${config.bgImage
    ? `var(--bg) url('${config.bgImage}') center/cover`
    : `linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(56, 189, 248, 0.06) 50%, var(--bg) 100%)`};
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
    radial-gradient(circle at 25% 25%, rgba(139, 92, 246, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 75% 75%, rgba(56, 189, 248, 0.05) 0%, transparent 50%);
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
    0 20px 40px rgba(0, 0, 0, 0.06),
    0 8px 20px rgba(139, 92, 246, 0.08),
    inset 0 1px 0 rgba(255, 255, 255, 0.95);
  border: 1px solid rgba(139, 92, 246, 0.12);
  position: relative;
}

.header {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.9) 0%, rgba(56, 189, 248, 0.85) 100%);
  color: white;
  padding: calc(var(--spacing) * 1.5);
  text-align: center;
  font-weight: 600;
  font-size: calc(var(--fs) * var(--title-scale));
  position: relative;
  box-shadow: 0 4px 12px rgba(139, 92, 246, 0.15);
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
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.95) 100%);
  position: relative;
}

.grid-item {
  background: rgba(255, 255, 255, 0.96);
  border-radius: var(--radius);
  padding: var(--spacing);
  border: 1px solid rgba(139, 92, 246, 0.08);
  box-shadow:
    0 4px 12px rgba(0, 0, 0, 0.03),
    0 2px 6px rgba(139, 92, 246, 0.05);
  position: relative;
  z-index: 1;
  overflow: hidden;
  transition: all 0.2s ease;
}

.grid-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  width: 6px;
  height: 100%;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.7) 0%, rgba(56, 189, 248, 0.7) 100%);
  opacity: 0.6;
}

.grid-item-title {
  font-weight: 600;
  font-size: calc(var(--fs) * 1.15);
  color: var(--text);
  margin-bottom: calc(var(--spacing) * 0.5);
  background: linear-gradient(90deg, rgba(139, 92, 246, 0.9), rgba(56, 189, 248, 0.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.grid-item-content {
  color: var(--text-light);
  white-space: pre-wrap;
  line-height: 1.6;
}

.grid-item.header {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(56, 189, 248, 0.08) 100%);
  border: 2px solid rgba(139, 92, 246, 0.2);
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.05),
    0 4px 12px rgba(139, 92, 246, 0.12);
  grid-column: 1 / -1;
}

.grid-item.header::before {
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.8) 0%, rgba(56, 189, 248, 0.6) 100%);
  width: 8px;
}

.grid-item.header .grid-item-title {
  color: rgba(139, 92, 246, 0.9);
  font-size: calc(var(--fs) * var(--title-scale) * 1.2);
  -webkit-text-fill-color: rgba(139, 92, 246, 0.9);
  text-align: center;
  margin-bottom: calc(var(--spacing) * 0.3);
}

.grid-item.header .grid-item-content {
  color: rgba(100, 116, 139, 0.8);
  text-align: center;
  font-weight: 500;
}

.grid-item.option {
  border: 2px dashed rgba(139, 92, 246, 0.15);
  background: linear-gradient(145deg, rgba(139, 92, 246, 0.04) 0%, rgba(255, 255, 255, 0.98) 100%);
}

.grid-item.option::before {
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.4) 0%, rgba(56, 189, 248, 0.3) 100%);
}

.grid-item.subCommand {
  background: linear-gradient(145deg, rgba(56, 189, 248, 0.06) 0%, rgba(255, 255, 255, 0.96) 100%);
  border-color: rgba(56, 189, 248, 0.12);
}

.grid-item.subCommand::before {
  background: rgba(56, 189, 248, 0.6);
}

.footer {
  background: linear-gradient(135deg, rgba(248, 250, 252, 0.8) 0%, rgba(255, 255, 255, 0.96) 100%);
  color: var(--text-light);
  padding: calc(var(--spacing) * 0.8);
  text-align: center;
  font-size: calc(var(--fs) * 0.85);
  border-top: 1px solid rgba(139, 92, 246, 0.08);
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
  background: linear-gradient(90deg, transparent, rgba(139, 92, 246, 0.3), transparent);
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

  private buildBody(config: any, layout: Layout): string {
    const grid = layout.items.map(item => {
      const title = item.title ? `<div class="grid-item-title">${this.safeText(item.title)}</div>` : ''
      const content = item.type === 'image'
        ? `<img src="${item.content}" alt="${this.safeText(item.title)}" loading="lazy">`
        : `<div class="grid-item-content">${this.safeText(item.content)}</div>`

      return `<div class="grid-item ${item.itemType}" style="grid-column:${item.col}/span ${item.colSpan};grid-row:${item.row}/span ${item.rowSpan}">${title}${content}</div>`
    }).join('')

    return `<div class="container" style="--grid-cols:${layout.cols}">
      ${config.header?.trim() ? `<div class="header">${config.header.trim()}</div>` : ''}
      <div class="grid-container">${grid}</div>
      ${config.footer?.trim() ? `<div class="footer">${config.footer.trim()}</div>` : ''}
    </div>`
  }

  private safeText(str: string): string {
    return String(str || '').replace(/[&<>"']/g, m => ({ '&': '&lt;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m])
  }
}
