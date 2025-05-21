import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { logger } from './index'

// 网格项配置
export interface GridItem {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  type: 'text' | 'image' | 'custom'
  content: string
  renderHtml?: boolean
  icon?: string
  iconType?: 'url' | 'material'
  iconSize?: number | string
  iconColor?: string
  title?: string
  style?: Record<string, any>
  contentStyle?: Record<string, any>
  onClick?: string
  link?: string
  badge?: string | number
}

// 渲染配置
export interface RenderConfig {
  header: {
    show: boolean;
    title?: string;
    logo?: string;
    height?: number;
    style?: Record<string, any>;
  }
  footer: {
    show: boolean;
    text?: string;
    style?: Record<string, any>;
  }
  layout: {
    rows: number;
    cols: number;
    gap?: number;
    padding?: number | string;
    items: GridItem[]
  }
  style?: {
    width?: number;
    height?: number;
    background?: string;
    darkMode?: boolean;
    accentColor?: string;
    fontFamily?: string;
    fontSize?: number;
    containerRadius?: number;
    itemRadius?: number;
    itemBorderWidth?: number;
    itemShadow?: string;
    animation?: boolean;
    compact?: boolean;
  }
  meta?: {
    version?: string;
    author?: string;
    description?: string;
    tags?: string[];
  }
}

/**
 * HTML转义工具函数
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 帮助渲染器类 - 只负责渲染逻辑
 */
export class Renderer {
  constructor(private ctx: Context) {}

  /**
   * 渲染帮助图片
   */
  public async render(config: RenderConfig): Promise<Buffer> {
    if (!config) throw new Error('渲染配置为空');

    try {
      return await this.renderHtml(this.generateHtml(config));
    } catch (err) {
      logger.error('渲染帮助图片失败', err);
      throw err;
    }
  }

  /**
   * 生成HTML
   */
  private generateHtml(config: RenderConfig): string {
    const isDarkMode = config.style.darkMode;
    const accentColor = config.style.accentColor || '#6750a4';
    const fontFamily = config.style.fontFamily || 'Roboto, sans-serif';
    const fontSize = config.style.fontSize || 16;
    const containerRadius = config.style.containerRadius || 28;
    const itemRadius = config.style.itemRadius || 16;
    const itemBorderWidth = config.style.itemBorderWidth ?? 1;
    const itemShadow = config.style.itemShadow || 'var(--md-sys-elevation-1)';
    const animation = config.style.animation !== false;
    const compact = config.style.compact === true;

    // 计算紧凑模式下的尺寸调整
    const paddingScale = compact ? 0.75 : 1;
    const gapScale = compact ? 0.75 : 1;

    // 精简CSS样式
    const css = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');

:root {
  --md-sys-color-primary: ${accentColor};
  --md-sys-color-on-primary: ${isDarkMode ? '#000000' : '#ffffff'};
  --md-sys-color-primary-container: ${isDarkMode ? '#7f67b3' : '#e8def8'};
  --md-sys-color-on-primary-container: ${isDarkMode ? '#ffffff' : '#21005d'};
  --md-sys-color-surface: ${isDarkMode ? '#1c1b1f' : '#ffffff'};
  --md-sys-color-on-surface: ${isDarkMode ? '#e6e1e5' : '#1c1b1f'};
  --md-sys-color-surface-variant: ${isDarkMode ? '#49454f' : '#e7e0ec'};
  --md-sys-color-on-surface-variant: ${isDarkMode ? '#cac4d0' : '#49454f'};
  --md-sys-color-outline: ${isDarkMode ? '#938f99' : '#79747e'};
  --md-sys-color-background: ${isDarkMode ? '#141218' : '#fdf8fd'};
  --md-sys-elevation-1: ${isDarkMode ? '0 1px 3px 0 rgba(0, 0, 0, 0.3)' : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'};
  --md-sys-elevation-2: ${isDarkMode ? '0 2px 6px 2px rgba(0, 0, 0, 0.15)' : '0 3px 6px 0 rgba(0, 0, 0, 0.07)'};
  --md-sys-elevation-3: ${isDarkMode ? '0 4px 8px 3px rgba(0, 0, 0, 0.15)' : '0 6px 10px 4px rgba(0, 0, 0, 0.05)'};
  --base-font-size: ${fontSize}px;
  --container-padding: ${24 * paddingScale}px;
  --item-padding: ${16 * paddingScale}px;
}

body {
  margin: 0;
  padding: 0;
  background: var(--md-sys-color-background);
  color: var(--md-sys-color-on-surface);
  font-family: ${fontFamily};
  font-size: var(--base-font-size);
}

.container {
  padding: var(--container-padding);
  box-sizing: border-box;
  background: var(--md-sys-color-surface);
  border-radius: ${containerRadius}px;
  box-shadow: var(--md-sys-elevation-2);
  width: ${config.style.width}px;
  ${config.style.height ? `height: ${config.style.height}px;` : ''}
  ${config.style.background ? `background: ${config.style.background};` : ''}
}

.header, .footer {
  display: flex;
  align-items: center;
  padding: ${16 * paddingScale}px;
  border-radius: ${itemRadius}px;
  box-shadow: var(--md-sys-elevation-1);
}

.header {
  background-color: var(--md-sys-color-primary-container);
  color: var(--md-sys-color-on-primary-container);
  margin-bottom: ${24 * paddingScale}px;
  ${config.header.height ? `height: ${config.header.height}px;` : ''}
  ${config.header.style ? Object.entries(config.header.style).map(([k, v]) => `${k}: ${v};`).join(' ') : ''}
}

.header-logo {
  height: ${56 * paddingScale}px;
  margin-right: ${16 * paddingScale}px;
  border-radius: ${8 * paddingScale}px;
}

.header-title {
  font-size: ${28 * (fontSize / 16)}px;
  font-weight: 500;
  margin: 0;
}

.grid-container {
  display: grid;
  width: 100%;
  gap: ${(config.layout.gap || 16) * gapScale}px;
  grid-template-rows: repeat(${config.layout.rows}, auto);
  grid-template-columns: repeat(${config.layout.cols}, 1fr);
  padding: ${config.layout.padding || 0};
}

.grid-item {
  background-color: var(--md-sys-color-surface);
  padding: var(--item-padding);
  border-radius: ${itemRadius}px;
  border: ${itemBorderWidth}px solid var(--md-sys-color-outline);
  box-shadow: ${itemShadow};
  overflow: hidden;
  ${animation ? 'transition: all 0.2s ease;' : ''}
}

${animation ? `.grid-item:hover {
  box-shadow: var(--md-sys-elevation-2);
  transform: translateY(-2px);
}` : ''}

.grid-item-header {
  display: flex;
  align-items: center;
  margin-bottom: ${12 * paddingScale}px;
  position: relative;
}

.grid-item-title {
  font-weight: 500;
  font-size: 1.1em;
  margin: 0 0 0.5em 0;
  color: var(--md-sys-color-on-surface);
}

.grid-item-icon {
  margin-right: ${12 * paddingScale}px;
  color: var(--md-sys-color-primary);
  font-size: 24px;
}

.grid-item-icon img {
  width: 24px;
  height: 24px;
  object-fit: contain;
}

.grid-item-text, .grid-item-custom {
  line-height: 1.6;
  color: var(--md-sys-color-on-surface);
}

.grid-item-image {
  max-width: 100%;
  display: block;
  margin: 0 auto;
  border-radius: ${8 * paddingScale}px;
}

.grid-item-badge {
  position: absolute;
  top: 0;
  right: 0;
  background-color: var(--md-sys-color-primary);
  color: var(--md-sys-color-on-primary);
  border-radius: 999px;
  padding: 2px 8px;
  font-size: 0.8em;
  font-weight: 500;
}

.footer {
  margin-top: ${24 * paddingScale}px;
  text-align: center;
  background-color: var(--md-sys-color-surface-variant);
  color: var(--md-sys-color-on-surface-variant);
  font-size: 14px;
  justify-content: center;
  ${config.footer.style ? Object.entries(config.footer.style).map(([k, v]) => `${k}: ${v};`).join(' ') : ''}
}`;

    // 构建HTML - 精简结构
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>
<div class="container">`;

    // 添加页眉
    if (config.header?.show) {
      html += `<div class="header">
  ${config.header.logo ? `<img src="${config.header.logo}" class="header-logo" />` : ''}
  <h1 class="header-title">${config.header.title || ''}</h1>
</div>`;
    }

    // 添加网格布局
    html += `<div class="grid-container">`;

    // 添加网格项
    for (const item of config.layout.items) {
      const itemStyle = [
        `grid-row: ${item.row} / span ${item.rowSpan || 1}`,
        `grid-column: ${item.col} / span ${item.colSpan || 1}`
      ];

      if (item.style) {
        Object.entries(item.style).forEach(([k, v]) => itemStyle.push(`${k}: ${v}`));
      }

      const content = this.renderGridItemContent(item);
      const clickAttr = item.onClick ? ` onclick="${item.onClick}"` : '';
      const linkWrapper = item.link
        ? `<a href="${item.link}" style="text-decoration:none; color:inherit; display:block;">${content}</a>`
        : content;

      html += `<div class="grid-item" style="${itemStyle.join('; ')}"${clickAttr}>${linkWrapper}</div>`;
    }

    html += `</div>`;

    // 添加页脚
    if (config.footer?.show) {
      html += `<div class="footer">${config.footer.text || ''}</div>`;
    }

    html += `</div></body></html>`;
    return html;
  }

  /**
   * 处理网格项内容
   */
  private renderGridItemContent(item: GridItem): string {
    // 处理图标
    let iconHtml = '';
    if (item.icon) {
      const iconStyle = [
        item.iconColor ? `color: ${item.iconColor}` : '',
        item.iconSize ? `font-size: ${item.iconSize}px` : ''
      ].filter(Boolean).join('; ');

      const styleAttr = iconStyle ? ` style="${iconStyle}"` : '';

      if (item.iconType === 'material') {
        iconHtml = `<span class="material-icons grid-item-icon"${styleAttr}>${item.icon}</span>`;
      } else if (item.iconType === 'url' || !item.iconType) {
        iconHtml = `<div class="grid-item-icon"${styleAttr}><img src="${item.icon}" alt="icon" /></div>`;
      }
    }

    // 处理徽章和标题
    const badgeHtml = item.badge
      ? `<span class="grid-item-badge">${item.badge}</span>`
      : '';
    const titleHtml = item.title
      ? `<h3 class="grid-item-title">${escapeHtml(item.title)}</h3>`
      : '';

    // 内容样式
    const contentStyleAttr = item.contentStyle
      ? ` style="${Object.entries(item.contentStyle).map(([k, v]) => `${k}: ${v}`).join('; ')}"`
      : '';

    // 处理内容
    let contentHtml = '';
    const content = item.content || '';
    const contentValue = item.renderHtml === true ? content : escapeHtml(content);

    const headerHtml = `<div class="grid-item-header">${iconHtml}${badgeHtml}</div>${titleHtml}`;

    // 根据内容类型生成HTML
    switch (item.type) {
      case 'text':
        contentHtml = `${headerHtml}<div class="grid-item-text"${contentStyleAttr}>${contentValue}</div>`;
        break;
      case 'image':
        contentHtml = `${headerHtml}<img src="${content}" class="grid-item-image"${contentStyleAttr} />`;
        break;
      default:
        contentHtml = `${headerHtml}<div class="grid-item-custom"${contentStyleAttr}>${contentValue}</div>`;
    }

    return contentHtml;
  }

  /**
   * 渲染HTML为图片
   */
  private async renderHtml(html: string): Promise<Buffer> {
    if (!this.ctx.puppeteer) {
      throw new Error('puppeteer 服务未启用，请确保安装并启用了 puppeteer 插件');
    }

    const page = await this.ctx.puppeteer.page();
    await page.setContent(html);
    const element = await page.$('.container');

    if (!element) throw new Error('无法找到渲染容器元素');

    return await element.screenshot({
      type: 'png',
      omitBackground: true
    }) as Buffer;
  }
}
