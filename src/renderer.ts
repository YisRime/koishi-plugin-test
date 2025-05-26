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
    const css = this.generateModernCSS(theme)
    const body = this.generateBody(theme, layout)

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="color-scheme" content="light dark">
  <style>${css}</style>
</head>
<body>${body}</body>
</html>`
  }

  /**
   * 生成现代化的CSS样式系统
   * @param theme - 主题配置
   * @returns 完整的现代CSS字符串
   */
  private generateModernCSS(theme: ThemeConfig): string {
    const primaryRgb = this.hexToRgb(theme.colors.primary)
    const accentRgb = this.hexToRgb(theme.colors.accent)
    const secondaryRgb = this.hexToRgb(theme.colors.secondary)
    const surfaceRgb = this.hexToRgb(theme.colors.surface)
    const backgroundRgb = this.hexToRgb(theme.colors.background)

    return `/* === 字体导入 === */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;600;700;800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600&display=swap');${theme.fontUrl ? `\n@import url('${theme.fontUrl}');` : ''}

/* === CSS自定义属性系统 === */
:root {
  /* 颜色系统 */
  --color-primary: ${theme.colors.primary};
  --color-primary-rgb: ${primaryRgb};
  --color-accent: ${theme.colors.accent};
  --color-accent-rgb: ${accentRgb};
  --color-secondary: ${theme.colors.secondary};
  --color-secondary-rgb: ${secondaryRgb};
  --color-surface: ${theme.colors.surface};
  --color-surface-rgb: ${surfaceRgb};
  --color-background: ${theme.colors.background};
  --color-background-rgb: ${backgroundRgb};
  --color-text: ${theme.colors.text};
  --color-text-secondary: ${theme.colors.textSecondary};
  --color-border: ${theme.colors.border};
  --color-shadow: ${theme.colors.shadow};

  /* 色彩变体 */
  --color-primary-light: rgba(var(--color-primary-rgb), 0.1);
  --color-primary-lighter: rgba(var(--color-primary-rgb), 0.05);
  --color-accent-light: rgba(var(--color-accent-rgb), 0.1);
  --color-secondary-light: rgba(var(--color-secondary-rgb), 0.1);
  --color-surface-elevated: rgba(var(--color-surface-rgb), 0.8);

  /* 几何系统 */
  --radius-xs: calc(${theme.borderRadius} * 0.5);
  --radius-sm: ${theme.borderRadius};
  --radius-md: calc(${theme.borderRadius} * 1.5);
  --radius-lg: calc(${theme.borderRadius} * 2);
  --radius-xl: calc(${theme.borderRadius} * 3);

  /* 间距系统 */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;

  /* 字体系统 */
  --font-family-base: ${theme.typography.fontFamily};
  --font-family-mono: 'JetBrains Mono', 'Fira Code', 'SF Mono', Consolas, monospace;
  --font-size-xs: ${Math.max(theme.typography.fontSize - 2, 10)}px;
  --font-size-sm: ${theme.typography.fontSize - 1}px;
  --font-size-base: ${theme.typography.fontSize}px;
  --font-size-lg: ${theme.typography.fontSize + 2}px;
  --font-size-xl: ${Math.floor(theme.typography.fontSize * theme.typography.titleSize)}px;
  --font-size-2xl: ${Math.floor(theme.typography.fontSize * theme.typography.titleSize * 1.2)}px;
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-semibold: 600;
  --font-weight-bold: 700;
  --line-height-tight: 1.25;
  --line-height-base: ${theme.typography.lineHeight};
  --line-height-relaxed: 1.6;

  /* 阴影系统 */
  --shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  --shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  --shadow-glow: 0 0 20px rgba(var(--color-primary-rgb), 0.15);

  /* 布局系统 */
  --grid-cols: ${this.getGridCols()};
  --container-max-width: 600px;
  --container-padding: ${theme.spacing.containerPadding};
  --item-padding: ${theme.spacing.itemPadding};
  --item-spacing: ${theme.spacing.itemSpacing}px;

  /* 毛玻璃效果 */
  --backdrop-blur: ${theme.effects.backdropBlur}px;
  --glass-bg: rgba(255, 255, 255, 0.08);
  --glass-border: rgba(255, 255, 255, 0.12);
}

/* === 全局重置与基础样式 === */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html {
  font-size: 16px;
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  font-family: var(--font-family-base);
  font-size: var(--font-size-base);
  line-height: var(--line-height-base);
  color: var(--color-text);
  background: ${this.generateBackgroundStyle(theme)};
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
  padding: ${theme.outerPadding}px;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  overflow-x: hidden;
}

/* === 容器系统 === */
.container {
  width: 100%;
  max-width: var(--container-max-width);
  min-width: 320px;
  padding: var(--container-padding);
  border-radius: var(--radius-lg);
  background: ${theme.effects.enableGlass ? 'var(--glass-bg)' : 'rgba(var(--color-surface-rgb), 0.95)'};
  border: 1px solid ${theme.effects.enableGlass ? 'var(--glass-border)' : 'rgba(var(--color-border), 0.5)'};
  box-shadow: var(--shadow-2xl), var(--shadow-glow);
  position: relative;
  ${theme.effects.enableGlass ? `backdrop-filter: blur(var(--backdrop-blur)); -webkit-backdrop-filter: blur(var(--backdrop-blur));` : ''}
}

.container::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,
    rgba(var(--color-primary-rgb), 0.02) 0%,
    rgba(var(--color-accent-rgb), 0.01) 50%,
    rgba(var(--color-secondary-rgb), 0.02) 100%);
  border-radius: inherit;
  pointer-events: none;
  z-index: -1;
}

/* === 网格布局系统 === */
.grid-container {
  display: grid;
  grid-template-columns: repeat(var(--grid-cols), 1fr);
  gap: var(--item-spacing);
  margin-bottom: var(--space-4);
  position: relative;
  z-index: 1;
}

.grid-container:last-child {
  margin-bottom: 0;
}

/* === 页头样式 === */
.header {
  background: linear-gradient(135deg,
    rgba(var(--color-primary-rgb), 0.1),
    rgba(var(--color-accent-rgb), 0.05));
  color: var(--color-text);
  padding: var(--space-5);
  text-align: center;
  border: 1px solid rgba(var(--color-primary-rgb), 0.2);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-md),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-lg);
  margin-bottom: var(--space-4);
  position: relative;
  overflow: hidden;
  ${theme.effects.enableGlass ? `backdrop-filter: blur(calc(var(--backdrop-blur) * 0.5));` : ''}
}

/* === 页脚样式 === */
.footer {
  background: rgba(var(--color-surface-rgb), 0.6);
  color: var(--color-text-secondary);
  font-size: var(--font-size-sm);
  font-weight: var(--font-weight-medium);
  padding: var(--space-3);
  border: 1px solid rgba(var(--color-border), 0.3);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
  text-align: center;
  margin-top: var(--space-4);
  ${theme.effects.enableGlass ? `backdrop-filter: blur(calc(var(--backdrop-blur) * 0.3));` : ''}
}

/* === 网格项目样式 === */
.grid-item {
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.1),
    rgba(255, 255, 255, 0.05));
  padding: var(--item-padding);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: var(--shadow-lg),
              inset 0 1px 0 rgba(255, 255, 255, 0.1);
  position: relative;
  min-height: 80px;
  overflow: visible;
  ${theme.effects.enableGlass ? `backdrop-filter: blur(calc(var(--backdrop-blur) * 0.7));` : ''}
}

.grid-item::before {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(135deg,
    rgba(var(--color-primary-rgb), 0.02),
    rgba(var(--color-accent-rgb), 0.01));
  border-radius: inherit;
  opacity: 0;
  pointer-events: none;
}

/* === 网格项目内容 === */
.grid-item-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  min-height: 24px;
}

.grid-item-title {
  font-weight: var(--font-weight-semibold);
  font-size: var(--font-size-xl);
  margin: 0;
  color: var(--color-primary);
  letter-spacing: -0.025em;
  line-height: var(--line-height-tight);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.grid-item-content {
  line-height: var(--line-height-base);
  color: var(--color-text-secondary);
  white-space: pre-wrap;
  font-size: var(--font-size-sm);
  word-break: break-word;
  font-weight: var(--font-weight-normal);
  opacity: 0.9;
}

.grid-item-badge {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(135deg,
    var(--color-accent),
    rgba(var(--color-accent-rgb), 0.8));
  color: white;
  border-radius: 12px;
  padding: 4px 8px;
  font-size: var(--font-size-xs);
  font-weight: var(--font-weight-bold);
  box-shadow: var(--shadow-lg),
              0 4px 12px rgba(var(--color-accent-rgb), 0.4);
  letter-spacing: 0.5px;
  min-width: 20px;
  text-align: center;
  line-height: 1;
  border: 2px solid rgba(255, 255, 255, 0.3);
  z-index: 10;
  white-space: nowrap;
}

/* === 项目类型样式 === */
.grid-item.subCommand::after {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 4px;
  background: linear-gradient(180deg,
    rgba(var(--color-secondary-rgb), 0.8),
    rgba(var(--color-primary-rgb), 0.6));
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px rgba(var(--color-secondary-rgb), 0.4);
}

.grid-item.option::after {
  content: '';
  position: absolute;
  left: 0;
  top: 20%;
  bottom: 20%;
  width: 4px;
  background: linear-gradient(180deg,
    rgba(var(--color-accent-rgb), 0.8),
    rgba(var(--color-secondary-rgb), 0.6));
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 8px rgba(var(--color-accent-rgb), 0.4);
}

.grid-item.title {
  background: linear-gradient(135deg,
    rgba(var(--color-primary-rgb), 0.12),
    rgba(var(--color-secondary-rgb), 0.08));
  border: 1px solid rgba(var(--color-primary-rgb), 0.3);
}

.grid-item.title .grid-item-title {
  font-size: var(--font-size-2xl);
  justify-content: center;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.04em;
  color: var(--color-primary);
}

.grid-item.command {
  background: linear-gradient(135deg,
    rgba(255, 255, 255, 0.12),
    rgba(255, 255, 255, 0.06));
  border-color: rgba(var(--color-primary-rgb), 0.25);
}

.grid-item.header {
  background: linear-gradient(135deg,
    rgba(var(--color-primary-rgb), 0.15),
    rgba(var(--color-accent-rgb), 0.1));
  border: 1px solid rgba(var(--color-primary-rgb), 0.35);
}

/* === 响应式设计 === */
@media (max-width: 768px) {
  :root {
    --container-max-width: 100%;
    --grid-cols: 1;
  }

  body {
    padding: var(--space-2);
  }

  .container {
    min-width: 280px;
    padding: var(--space-4);
    border-radius: var(--radius-md);
  }

  .grid-container {
    gap: var(--space-2);
  }

  .grid-item {
    padding: var(--space-3);
    min-height: 60px;
  }

  .grid-item-title {
    font-size: var(--font-size-lg);
  }

  .grid-item-content {
    font-size: var(--font-size-xs);
  }

  .header, .footer {
    padding: var(--space-3);
  }
}

@media (max-width: 480px) {
  body {
    padding: var(--space-1);
  }

  .container {
    padding: var(--space-3);
    border-radius: var(--radius-sm);
  }

  .grid-item {
    padding: var(--space-2);
  }

  .grid-item-badge {
    top: -6px;
    right: -6px;
    padding: 2px 6px;
  }
}

/* === 打印样式 === */
@media print {
  body {
    background: white !important;
    color: black !important;
  }

  .container {
    background: white !重要;
    border: 1px solid #ccc !important;
    box-shadow: none !important;
  }

  .grid-item {
    break-inside: avoid;
    background: white !important;
    border: 1px solid #ddd !important;
  }
}`
  }

  /**
   * 生成背景样式
   * @param theme - 主题配置
   * @returns 背景CSS字符串
   */
  private generateBackgroundStyle(theme: ThemeConfig): string {
    if (theme.backgroundImage) {
      return `linear-gradient(135deg,
        rgba(var(--color-background-rgb), 0.9) 0%,
        rgba(var(--color-background-rgb), 0.7) 50%,
        rgba(var(--color-background-rgb), 0.9) 100%),
      url('${theme.backgroundImage}') center/cover fixed`
    }
    return `linear-gradient(135deg,
      var(--color-background) 0%,
      rgba(var(--color-surface-rgb), 0.8) 50%,
      var(--color-background) 100%)`
  }

  /**
   * 获取网格列数
   * @returns 网格列数
   */
  private getGridCols(): number {
    // 这里可以根据需要动态计算，暂时返回默认值
    return 2
  }

  /**
   * 生成页面主体内容
   * @param theme - 主题配置
   * @param layout - 布局配置
   * @returns HTML主体字符串
   */
  private generateBody(theme: ThemeConfig, layout: LayoutConfig): string {
    const grid = layout.items.map((item, index) => {
      const badge = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : ''
      const title = item.title ? `<h3 class="grid-item-title">${this.escape(item.title)}</h3>` : ''
      const content = item.type === 'image'
        ? `<img src="${item.content}" style="max-width:100%;border-radius:var(--radius-sm);box-shadow:var(--shadow-md)" alt="${this.escape(item.title)}" loading="lazy">`
        : `<div class="grid-item-content">${this.escape(item.content)}</div>`

      return `<div class="grid-item${item.itemType ? ` ${item.itemType}` : ''}"${item.id ? ` id="${item.id}"` : ''} style="grid-column:${item.col}/span ${item.colSpan || 1};grid-row:${item.row}/span ${item.rowSpan || 1}">${badge}<div class="grid-item-header">${title}</div>${content}</div>`
    }).join('')

    return `<div class="container" style="--grid-cols:${layout.cols}">${theme.header.show ? `<div class="header">${this.escape(theme.header.text)}</div>` : ''}<div class="grid-container">${grid}</div>${theme.footer.show ? `<div class="footer">${this.escape(theme.footer.text)}</div>` : ''}</div>`
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
