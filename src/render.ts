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
  itemType?: 'command' | 'subCommand' | 'option' | 'title' | 'header' // 项目类型
}

/**
 * 样式配置接口
 */
export interface StyleConfig {
  // 全局样式
  width?: number;
  background?: string;
  accentColor?: string;
  fontFamily?: string;
  fontSize?: number;
  containerRadius?: number;
  itemRadius?: number;
  textColor?: string;

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

  // 子命令和选项样式
  subCommandBackground?: string;
  subCommandBorderColor?: string;
  subCommandIconColor?: string;

  optionBackground?: string;
  optionBorderColor?: string;
  optionIconColor?: string;
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
 * 帮助渲染器类 - 精简版
 */
export class Renderer {
  constructor(private ctx: Context) {}

  /**
   * 渲染帮助图片
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
    // 合并样式处理 - 简化变量定义
    const s = style || {}; // 使用短变量名减少重复代码
    const itemBorder = s.itemBorder || `1px solid ${s.itemBorderColor}`;

    // 精简CSS - 移除重复属性和不必要的嵌套
    const css = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');

:root {
  --accent-color: ${s.accentColor};
  --font-color: ${s.textColor};
  --bg-color: ${s.background};
  --item-bg: ${s.itemBackground};
  --header-bg: ${s.headerBackground};
  --header-color: ${s.headerColor};
  --footer-bg: ${s.footerBackground};
  --footer-color: ${s.footerColor};
  --subcmd-bg: ${s.subCommandBackground};
  --subcmd-border: ${s.subCommandBorderColor};
  --subcmd-icon: ${s.subCommandIconColor};
  --option-bg: ${s.optionBackground};
  --option-border: ${s.optionBorderColor};
  --option-icon: ${s.optionIconColor};
}

body {
  margin: 0;
  padding: 0;
  background: var(--bg-color);
  color: var(--font-color);
  font-family: ${s.fontFamily};
  font-size: ${s.fontSize}px;
}

.container {
  padding: 15px;
  box-sizing: border-box;
  background: var(--bg-color);
  border-radius: ${s.containerRadius}px;
  width: ${s.width}px;
}

.header, .footer {
  border-radius: ${s.itemRadius}px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
}

.header {
  background-color: var(--header-bg);
  color: var(--header-color);
  padding: ${s.headerPadding};
}

.header-logo {
  height: 28px;
  margin-right: 8px;
  border-radius: 4px;
}

.header-title {
  font-size: 1.1em;
  font-weight: 600;
  margin: 0;
}

.grid-container {
  display: grid;
  width: 100%;
  gap: ${s.itemSpacing}px;
  grid-template-rows: repeat(${content.layout.rows}, auto);
  grid-template-columns: repeat(${content.layout.cols}, 1fr);
}

.grid-item {
  background-color: var(--item-bg);
  padding: ${s.itemPadding};
  border-radius: ${s.itemRadius}px;
  border: ${itemBorder};
  box-shadow: ${s.itemShadow};
  transition: transform 0.15s, box-shadow 0.15s;
}

.grid-item:hover {
  transform: translateY(-1px);
  box-shadow: 0 3px 6px rgba(0,0,0,0.08);
}

.grid-item-header {
  display: flex;
  align-items: center;
  margin-bottom: 6px;
  position: relative;
}

.grid-item-title {
  font-weight: ${s.titleWeight};
  font-size: ${s.titleSize}em;
  margin: 0 0 4px 0;
  color: ${s.titleColor};
}

.grid-item-icon {
  margin-right: 6px;
  color: ${s.iconColor};
  font-size: ${s.iconSize}px;
  font-family: 'Material Icons Round';
}

.grid-item-content {
  line-height: ${s.contentLineHeight};
  font-size: ${s.contentSize}px;
  white-space: ${s.contentWhiteSpace};
  max-height: ${s.contentMaxHeight};
  overflow: ${s.contentOverflow};
}

.grid-item-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  background-color: ${s.badgeBackground || s.accentColor};
  color: ${s.badgeColor};
  border-radius: 999px;
  padding: ${s.badgePadding};
  font-size: ${s.badgeSize}em;
  font-weight: 500;
  box-shadow: 0 1px 2px rgba(0,0,0,0.12);
}

.footer {
  margin-top: 12px;
  text-align: center;
  background-color: var(--footer-bg);
  color: var(--footer-color);
  font-size: 12px;
  justify-content: center;
  padding: ${s.footerPadding};
}

/* 子命令和选项样式 */
.grid-item.subCommand, .grid-item.option {
  position: relative;
}
.grid-item.subCommand::before, .grid-item.option::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 0;
  bottom: 0;
  width: 3px;
  border-radius: 2px;
}
.grid-item.subCommand {
  background-color: var(--subcmd-bg);
  border-color: var(--subcmd-border);
}
.grid-item.subCommand::before {
  background: var(--subcmd-icon);
}
.grid-item.subCommand .grid-item-icon {
  color: var(--subcmd-icon);
}
.grid-item.option {
  background-color: var(--option-bg);
  border-color: var(--option-border);
}
.grid-item.option::before {
  background: var(--option-icon);
}
.grid-item.option .grid-item-icon {
  color: var(--option-icon);
}
.grid-item.title .grid-item-title {
  font-size: 1.2em;
  color: var(--accent-color);
  font-weight: 600;
}`;

    // 构建HTML - 使用模板字面量简化结构
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body><div class="container">`;

    // 页眉
    if (content.header?.show) {
      html += `<div class="header">
        ${content.header.logo ? `<img src="${content.header.logo}" class="header-logo" />` : ''}
        <h1 class="header-title">${escapeHtml(content.header.title || '')}</h1>
      </div>`;
    }

    // 网格布局
    html += `<div class="grid-container">`;

    // 网格项 - 使用map简化循环
    html += content.layout.items.map(item => {
      const itemStyle = `grid-row: ${item.row} / span ${item.rowSpan || 1}; grid-column: ${item.col} / span ${item.colSpan || 1}`;
      const itemTypeClass = item.itemType ? ` ${item.itemType}` : '';
      const idAttr = item.id ? `id="${item.id}"` : '';

      return `<div class="grid-item${itemTypeClass}" ${idAttr} style="${itemStyle}">${this.renderGridItemContent(item)}</div>`;
    }).join('');

    html += `</div>`;

    // 页脚
    if (content.footer?.show) {
      html += `<div class="footer">${escapeHtml(content.footer.text || '')}</div>`;
    }

    html += `</div></body></html>`;
    return html;
  }

  /**
   * 处理网格项内容 - 精简版
   */
  private renderGridItemContent(item: GridItem): string {
    // 优化图标生成
    const iconHtml = item.icon && item.iconType === 'material'
      ? `<span class="grid-item-icon">${item.icon}</span>`
      : '';

    // 合并徽章和标题生成
    const badgeHtml = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : '';
    const titleHtml = item.title ? `<h3 class="grid-item-title">${escapeHtml(item.title)}</h3>` : '';

    // 组合内容HTML
    const headerHtml = `<div class="grid-item-header">${iconHtml}${badgeHtml}</div>${titleHtml}`;
    const contentHtml = item.type === 'image'
      ? `<img src="${item.content}" style="max-width: 100%;" />`
      : `<div class="grid-item-content">${escapeHtml(item.content)}</div>`;

    return headerHtml + contentHtml;
  }

  /**
   * 渲染HTML为图片 - 简化版
   */
  private async renderHtml(html: string): Promise<Buffer> {
    if (!this.ctx.puppeteer) throw new Error('puppeteer 服务未启用');

    const page = await this.ctx.puppeteer.page();
    await page.setContent(html);
    const element = await page.$('.container');

    if (!element) throw new Error('无法找到渲染容器元素');
    return await element.screenshot({ type: 'png', omitBackground: true }) as Buffer;
  }
}
