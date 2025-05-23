import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { logger } from './index'
import { CommandData } from './extract'

/**
 * 菜单命令数据，保持与 MenuCommandData 一致
 */
export interface MenuCommandData extends CommandData {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  subCommands?: MenuCommandData[]
}

/**
 * 菜单配置，包含所有命令与布局信息
 */
export interface MenuConfig {
  commands: MenuCommandData[];
  layout: {
    rows: number;
    cols: number;
  };
}

/**
 * 网格项配置 - 只保留内容和布局信息
 */
export interface GridItem {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  type: 'text' | 'image'
  content: string
  title?: string
  icon?: string
  iconType?: 'material'
  badge?: string | number
  id?: string // 用于样式引用的唯一标识
}

/**
 * 样式配置接口
 */
export interface StyleConfig {
  // 全局样式
  width?: number;
  background?: string;
  darkMode?: boolean;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: number;
  containerRadius?: number;
  itemRadius?: number;

  // 网格项样式
  itemBackground?: string;
  itemPadding?: string;
  itemBorder?: string;
  itemBorderColor?: string;
  itemShadow?: string;
  itemSpacing?: number;

  // 标题样式
  titleSize?: number;
  titleWeight?: string;
  titleColor?: string;

  // 内容样式
  contentSize?: number;
  contentLineHeight?: number;
  contentWhiteSpace?: string;
  contentMaxHeight?: string;
  contentOverflow?: string;

  // 图标样式
  iconSize?: number;
  iconColor?: string;

  // 徽章样式
  badgeBackground?: string;
  badgeColor?: string;
  badgeSize?: number;
  badgePadding?: string;

  // 头部/尾部样式
  headerBackground?: string;
  headerColor?: string;
  footerBackground?: string;
  footerColor?: string;
  headerPadding?: string;
  footerPadding?: string;
}

/**
 * 内容配置接口
 */
export interface ContentConfig {
  header: {
    show: boolean;
    title?: string;
    logo?: string;
  }
  footer: {
    show: boolean;
    text?: string;
  }
  layout: {
    rows: number;
    cols: number;
    gap?: number;
    items: GridItem[]
  }
}

/**
 * HTML转义工具函数
 */
function escapeHtml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  const safeStr = String(unsafe);
  return safeStr
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
   * @param content 内容配置
   * @param style 样式配置
   */
  public async render(content: ContentConfig, style: StyleConfig): Promise<Buffer> {
    if (!content) throw new Error('渲染内容配置为空');

    try {
      return await this.renderHtml(this.generateHtml(content, style));
    } catch (err) {
      logger.error('渲染帮助图片失败', err);
      throw err;
    }
  }

  /**
   * 生成HTML
   */
  private generateHtml(content: ContentConfig, style: StyleConfig): string {
    // 样式变量
    const isDarkMode = style?.darkMode;
    const accentColor = style?.accentColor || '#6750a4';
    const fontFamily = style?.fontFamily || 'Roboto, sans-serif';
    const fontSize = style?.fontSize || 16;
    const containerRadius = style?.containerRadius || 28;
    const itemRadius = style?.itemRadius || 16;

    // 新增网格项样式变量
    const itemBackground = style?.itemBackground || (isDarkMode ? '#1c1b1f' : '#ffffff');
    const itemPadding = style?.itemPadding || '16px';
    const itemBorder = style?.itemBorder || `1px solid ${isDarkMode ? '#938f99' : '#79747e'}`;
    const itemShadow = style?.itemShadow || 'none';
    const itemSpacing = style?.itemSpacing || 16;

    // 内容样式变量
    const titleSize = style?.titleSize || 1.1;
    const titleWeight = style?.titleWeight || '500';
    const titleColor = style?.titleColor || 'inherit';
    const contentSize = style?.contentSize || fontSize;
    const contentLineHeight = style?.contentLineHeight || 1.6;
    const contentWhiteSpace = style?.contentWhiteSpace || 'normal';
    const contentMaxHeight = style?.contentMaxHeight || 'none';
    const contentOverflow = style?.contentOverflow || 'auto';

    // 图标和徽章样式
    const iconSize = style?.iconSize || 24;
    const iconColor = style?.iconColor || accentColor;
    const badgeBackground = style?.badgeBackground || accentColor;
    const badgeColor = style?.badgeColor || 'white';
    const badgeSize = style?.badgeSize || 0.8;
    const badgePadding = style?.badgePadding || '2px 8px';

    // 页眉页脚样式
    const headerBackground = style?.headerBackground || (isDarkMode ? '#7f67b3' : '#e8def8');
    const headerColor = style?.headerColor || (isDarkMode ? '#ffffff' : '#21005d');
    const footerBackground = style?.footerBackground || (isDarkMode ? '#49454f' : '#e7e0ec');
    const footerColor = style?.footerColor || (isDarkMode ? '#cac4d0' : '#49454f');
    const headerPadding = style?.headerPadding || '16px';
    const footerPadding = style?.footerPadding || '16px';

    // 简化的CSS
    const css = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons');

:root {
  --accent-color: ${accentColor};
  --font-color: ${isDarkMode ? '#e6e1e5' : '#1c1b1f'};
  --bg-color: ${isDarkMode ? '#141218' : style?.background || '#ffffff'};
  --item-bg: ${itemBackground};
  --header-bg: ${headerBackground};
  --header-color: ${headerColor};
  --footer-bg: ${footerBackground};
  --footer-color: ${footerColor};
}

body {margin: 0; padding: 0; background: var(--bg-color); color: var(--font-color); font-family: ${fontFamily}; font-size: ${fontSize}px;}
.container {padding: 24px; box-sizing: border-box; background: var(--bg-color); border-radius: ${containerRadius}px; width: ${style?.width || 800}px;}
.header, .footer {border-radius: ${itemRadius}px;}
.header {background-color: var(--header-bg); color: var(--header-color); margin-bottom: 24px; padding: ${headerPadding};}
.header-logo {height: 56px; margin-right: 16px; border-radius: 8px;}
.header-title {font-size: 1.5em; font-weight: 500; margin: 0;}
.grid-container {display: grid; width: 100%; gap: ${itemSpacing}px; grid-template-rows: repeat(${content.layout.rows}, auto); grid-template-columns: repeat(${content.layout.cols}, 1fr);}
.grid-item {background-color: var(--item-bg); padding: ${itemPadding}; border-radius: ${itemRadius}px; border: ${itemBorder}; box-shadow: ${itemShadow};}
.grid-item-header {display: flex; align-items: center; margin-bottom: 12px; position: relative;}
.grid-item-title {font-weight: ${titleWeight}; font-size: ${titleSize}em; margin: 0 0 0.5em 0; color: ${titleColor};}
.grid-item-icon {margin-right: 12px; color: ${iconColor}; font-size: ${iconSize}px;}
.grid-item-content {line-height: ${contentLineHeight}; font-size: ${contentSize}px; white-space: ${contentWhiteSpace}; max-height: ${contentMaxHeight}; overflow: ${contentOverflow};}
.grid-item-badge {position: absolute; top: 0; right: 0; background-color: ${badgeBackground}; color: ${badgeColor}; border-radius: 999px; padding: ${badgePadding}; font-size: ${badgeSize}em; font-weight: 500;}
.footer {margin-top: 24px; text-align: center; background-color: var(--footer-bg); color: var(--footer-color); font-size: 14px; justify-content: center; padding: ${footerPadding};}`;

    // HTML构建
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>
<div class="container">`;

    // 页眉
    if (content.header?.show) {
      html += `<div class="header">
  ${content.header.logo ? `<img src="${content.header.logo}" class="header-logo" />` : ''}
  <h1 class="header-title">${content.header.title || ''}</h1>
</div>`;
    }

    // 网格布局
    html += `<div class="grid-container">`;

    // 网格项
    for (const item of content.layout.items) {
      const itemStyle = [
        `grid-row: ${item.row} / span ${item.rowSpan || 1}`,
        `grid-column: ${item.col} / span ${item.colSpan || 1}`
      ];

      html += `<div class="grid-item" ${item.id ? `id="${item.id}"` : ''} style="${itemStyle.join('; ')}">
        ${this.renderGridItemContent(item)}
      </div>`;
    }

    html += `</div>`;

    // 页脚
    if (content.footer?.show) {
      html += `<div class="footer">${content.footer.text || ''}</div>`;
    }

    html += `</div></body></html>`;
    return html;
  }

  /**
   * 处理网格项内容
   */
  private renderGridItemContent(item: GridItem): string {
    // 图标
    let iconHtml = '';
    if (item.icon) {
      iconHtml = item.iconType === 'material'
        ? `<span class="material-icons grid-item-icon">${item.icon}</span>`
        : '';
    }

    // 徽章和标题
    const badgeHtml = item.badge
      ? `<span class="grid-item-badge">${String(item.badge)}</span>`
      : '';

    const titleHtml = item.title
      ? `<h3 class="grid-item-title">${escapeHtml(item.title)}</h3>`
      : '';

    // 内容HTML - 不再使用单独的contentStyle
    const headerHtml = `<div class="grid-item-header">${iconHtml}${badgeHtml}</div>${titleHtml}`;

    if (item.type === 'image') {
      return `${headerHtml}<img src="${item.content}" style="max-width: 100%;" />`;
    }

    return `${headerHtml}<div class="grid-item-content">${escapeHtml(item.content)}</div>`;
  }

  /**
   * 渲染HTML为图片
   */
  private async renderHtml(html: string): Promise<Buffer> {
    if (!this.ctx.puppeteer) {
      throw new Error('puppeteer 服务未启用');
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
