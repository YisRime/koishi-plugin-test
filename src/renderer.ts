/**
 * 主题配置接口
 * 定义了渲染器所需的所有主题相关配置选项
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
 * 定义网格布局的基本结构
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
 * 定义单个网格项的所有属性
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
 * 主题渲染器类
 * 负责将主题配置和布局配置转换为HTML和CSS
 */
export class ThemeRenderer {
  /**
   * 生成完整的HTML文档
   * @param theme - 主题配置对象
   * @param layout - 布局配置对象
   * @returns 完整的HTML字符串
   */
  generateHtml(theme: ThemeConfig, layout: LayoutConfig): string {
    const glassEffect = theme.effects.enableGlass ? `backdrop-filter:blur(${theme.effects.backdropBlur}px);-webkit-backdrop-filter:blur(${theme.effects.backdropBlur}px);` : ''
    const bg = theme.backgroundImage ? `background:linear-gradient(135deg,${theme.colors.background}90,${theme.colors.background}60),url('${theme.backgroundImage}') center/cover fixed;` : `background:linear-gradient(135deg,${theme.colors.background},${theme.colors.surface});`

    const css = this.generateCSS(theme, glassEffect, bg)
    const body = this.generateBody(theme, layout, glassEffect)

    return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style></head><body>${body}</body></html>`
  }

  /**
   * 生成现代化的CSS样式
   * @param theme - 主题配置
   * @param glassEffect - 毛玻璃效果CSS
   * @param bg - 背景CSS
   * @returns 优化后的CSS字符串
   */
  private generateCSS(theme: ThemeConfig, glassEffect: string, bg: string): string {
    const primaryRgb = this.hexToRgb(theme.colors.primary)
    const accentRgb = this.hexToRgb(theme.colors.accent)
    const secondaryRgb = this.hexToRgb(theme.colors.secondary)

    return `@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Noto+Sans+SC:wght@300;400;500;600;700&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round&display=swap');${theme.fontUrl ? `\n@import url('${theme.fontUrl}');` : ''}

:root{
  --primary:${theme.colors.primary};--primary-rgb:${primaryRgb};
  --accent:${theme.colors.accent};--accent-rgb:${accentRgb};
  --secondary:${theme.colors.secondary};--secondary-rgb:${secondaryRgb};
  --surface:${theme.colors.surface};--bg:${theme.colors.background};
  --text:${theme.colors.text};--text-secondary:${theme.colors.textSecondary};
  --border:${theme.colors.border};--shadow:${theme.colors.shadow};
  --radius:${theme.borderRadius};
}

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}

body{
  font:${theme.typography.fontSize}px/${theme.typography.lineHeight} ${theme.typography.fontFamily};
  color:var(--text);${bg}
  -webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;
  padding:${theme.outerPadding}px;display:flex;align-items:flex-start;justify-content:center;
  min-height:100vh;overflow-x:hidden;
}

.container{
  max-width:540px;min-width:320px;width:100%;
  padding:${theme.spacing.containerPadding};
  border-radius:calc(var(--radius) * 1.5);
  background:rgba(255,255,255,0.02);
  border:1px solid rgba(255,255,255,0.1);
  box-shadow:0 20px 60px rgba(0,0,0,0.1),0 8px 25px rgba(0,0,0,0.05),inset 0 1px 0 rgba(255,255,255,0.1);
  position:relative;${glassEffect}
  transform:translateZ(0);
}

.container::before{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(var(--primary-rgb),0.03),rgba(var(--accent-rgb),0.02));
  border-radius:inherit;pointer-events:none;
}

.grid-container{
  display:grid;gap:${theme.spacing.itemSpacing * 1.2}px;
  grid-template-columns:repeat(var(--grid-cols),1fr);
  grid-auto-rows:minmax(auto,1fr);margin-bottom:${theme.innerPadding}px;
  position:relative;z-index:1;
}

.grid-container:last-child{margin-bottom:0}

.header{
  background:linear-gradient(135deg,rgba(var(--primary-rgb),0.08),rgba(var(--accent-rgb),0.05));
  color:var(--text);padding:${parseInt(theme.spacing.itemPadding) + 4}px;
  text-align:center;border:1px solid rgba(var(--primary-rgb),0.15);
  border-radius:calc(var(--radius) * 1.2);
  box-shadow:0 4px 20px rgba(var(--primary-rgb),0.1),inset 0 1px 0 rgba(255,255,255,0.1);
  font-weight:600;font-size:1.1em;margin-bottom:${theme.innerPadding}px;
  ${glassEffect}position:relative;overflow:hidden;
}

.footer{
  background:rgba(var(--surface),0.6);color:var(--text-secondary);
  font-size:0.85em;padding:${parseInt(theme.spacing.itemPadding) - 2}px;
  border:1px solid rgba(var(--border),0.5);border-radius:var(--radius);
  box-shadow:0 2px 10px rgba(0,0,0,0.05);text-align:center;
  margin-top:${theme.innerPadding}px;${glassEffect}font-weight:500;
}

.grid-item{
  background:linear-gradient(135deg,rgba(255,255,255,0.08),rgba(255,255,255,0.02));
  padding:${theme.spacing.itemPadding};border-radius:var(--radius);
  border:1px solid rgba(255,255,255,0.08);
  box-shadow:0 8px 32px rgba(0,0,0,0.08),0 2px 8px rgba(0,0,0,0.04),inset 0 1px 0 rgba(255,255,255,0.1);
  position:relative;${glassEffect}min-height:80px;overflow:visible;
}

.grid-item:hover{
  transform:translateY(-2px);
  box-shadow:0 12px 40px rgba(0,0,0,0.12),0 4px 16px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.15);
  border-color:rgba(var(--primary-rgb),0.2);
}

.grid-item-header{
  display:flex;align-items:center;justify-content:space-between;
  margin-bottom:8px;min-height:24px;
}

.grid-item-title{
  font-weight:${theme.typography.titleWeight};
  font-size:${theme.typography.titleSize}em;margin:0;
  color:var(--primary);letter-spacing:-0.02em;line-height:1.3;
  display:flex;align-items:center;gap:8px;
  text-shadow:0 1px 2px rgba(0,0,0,0.1);
}

.grid-item-icon{
  color:var(--primary);font-size:18px;font-family:'Material Icons Round';
  opacity:0.9;filter:drop-shadow(0 1px 2px rgba(0,0,0,0.1));
}

.grid-item-content{
  line-height:${theme.typography.lineHeight};color:var(--text-secondary);
  white-space:pre-wrap;font-size:0.9em;word-break:break-word;
  font-weight:400;opacity:0.9;
}

.grid-item-badge{
  position:absolute;top:-8px;right:-8px;
  background:linear-gradient(135deg,var(--accent),rgba(var(--accent-rgb),0.8));
  color:white;border-radius:10px;padding:3px 7px;
  font-size:0.65em;font-weight:700;
  box-shadow:0 4px 12px rgba(var(--accent-rgb),0.3),0 1px 3px rgba(0,0,0,0.2);
  letter-spacing:0.3px;min-width:18px;text-align:center;
  line-height:1.1;border:2px solid rgba(255,255,255,0.3);
  z-index:10;white-space:nowrap;
}

.grid-item.subCommand::after{
  content:'';position:absolute;left:0;top:20%;bottom:20%;width:3px;
  background:linear-gradient(180deg,rgba(var(--secondary-rgb),0.8),rgba(var(--primary-rgb),0.6));
  border-radius:0 2px 2px 0;
  box-shadow:0 0 8px rgba(var(--secondary-rgb),0.3);
}

.grid-item.option::after{
  content:'';position:absolute;left:0;top:20%;bottom:20%;width:3px;
  background:linear-gradient(180deg,rgba(var(--accent-rgb),0.8),rgba(var(--secondary-rgb),0.6));
  border-radius:0 2px 2px 0;
  box-shadow:0 0 8px rgba(var(--accent-rgb),0.3);
}

.grid-item.title{
  background:linear-gradient(135deg,rgba(var(--primary-rgb),0.1),rgba(var(--secondary-rgb),0.06));
  border:1px solid rgba(var(--primary-rgb),0.25);
}

.grid-item.title .grid-item-title{
  font-size:1.2em;justify-content:center;font-weight:700;
  letter-spacing:-0.03em;color:var(--primary);
}

.grid-item.command{
  background:linear-gradient(135deg,rgba(255,255,255,0.1),rgba(255,255,255,0.04));
  border-color:rgba(var(--primary-rgb),0.2);
}

.grid-item.header{
  background:linear-gradient(135deg,rgba(var(--primary-rgb),0.12),rgba(var(--accent-rgb),0.08));
  border:1px solid rgba(var(--primary-rgb),0.3);
}

@media (max-width:768px){
  body{padding:8px}
  .container{min-width:300px;padding:16px}
  .grid-container{grid-template-columns:1fr !important;gap:8px}
  .grid-item{padding:12px;min-height:60px}
  .grid-item-title{font-size:1em}
  .grid-item-content{font-size:0.85em}
  .header,.footer{padding:12px}
}

@media (max-width:480px){
  body{padding:4px}
  .container{padding:12px;border-radius:var(--radius)}
  .grid-item{padding:10px}
}`
  }

  /**
   * 生成页面主体内容
   * @param theme - 主题配置
   * @param layout - 布局配置
   * @param glassEffect - 毛玻璃效果CSS
   * @returns HTML主体字符串
   */
  private generateBody(theme: ThemeConfig, layout: LayoutConfig, glassEffect: string): string {
    const grid = layout.items.map(item => {
      const icon = item.icon ? `<span class="grid-item-icon">${item.icon}</span>` : ''
      const badge = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : ''
      const title = item.title ? `<h3 class="grid-item-title">${icon}${this.escape(item.title)}</h3>` : ''
      const content = item.type === 'image' ? `<img src="${item.content}" style="max-width:100%;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,0.15)" alt="${this.escape(item.title)}">` : `<div class="grid-item-content">${this.escape(item.content)}</div>`

      return `<div class="grid-item${item.itemType ? ` ${item.itemType}` : ''}"${item.id ? ` id="${item.id}"` : ''} style="grid-column:${item.col}/span ${item.colSpan || 1};grid-row:${item.row}/span ${item.rowSpan || 1}">${badge}<div class="grid-item-header">${title}</div>${content}</div>`
    }).join('')

    return `<div class="container" style="--grid-rows:${layout.rows};--grid-cols:${layout.cols}">${theme.header.show ? `<div class="header">${this.escape(theme.header.text)}</div>` : ''}<div class="grid-container">${grid}</div>${theme.footer.show ? `<div class="footer">${this.escape(theme.footer.text)}</div>` : ''}</div>`
  }

  /**
   * 将十六进制颜色转换为RGB
   * @param hex - 十六进制颜色值
   * @returns RGB值字符串 (格式: "r,g,b")
   */
  private hexToRgb(hex: string): string {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}` : '0,0,0'
  }

  /**
   * 转义HTML特殊字符以防止XSS攻击
   * @param str - 需要转义的字符串
   * @returns 转义后的安全字符串
   */
  private escape(str: string): string {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
