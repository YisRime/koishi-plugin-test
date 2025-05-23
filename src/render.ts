import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { logger } from './index'
import { CommandData } from './extract'
import { Config } from './index'

/**
 * 菜单命令数据
 * @interface MenuCommandData
 */
export interface MenuCommandData extends CommandData {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  subCommands?: MenuCommandData[]
}

/**
 * 菜单配置
 * @interface MenuConfig
 */
export interface MenuConfig {
  commands: MenuCommandData[];
  layout: {
    rows: number;
    cols: number;
  };
}

/**
 * 网格项配置
 * @interface GridItem
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
  id?: string
  itemType?: 'command' | 'subCommand' | 'option' | 'title' | 'header'
}

/**
 * 内容配置
 * @interface ContentConfig
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
 * @param {any} unsafe 不安全的文本
 * @returns {string} 转义后的文本
 */
function escapeHtml(unsafe: any): string {
  if (unsafe === null || unsafe === undefined) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * 帮助渲染器类
 * @class Renderer
 */
export class Renderer {
  private config: Config;

  /**
   * 创建渲染器实例
   * @param {Context} ctx Koishi上下文
   * @param {Config} config 配置
   */
  constructor(private ctx: Context, config: Config) {
    this.config = config || {};
  }

  /**
   * 渲染帮助图片
   * @param {ContentConfig} content 内容配置
   * @returns {Promise<Buffer>} 图片buffer
   */
  public async render(content: ContentConfig): Promise<Buffer> {
    if (!content) throw new Error('渲染内容配置为空');
    try {
      return await this.renderHtml(this.generateHtml(content));
    } catch (err) {
      logger.error('渲染帮助图片失败', err);
      throw err;
    }
  }

  /**
   * 生成HTML
   * @param {ContentConfig} content 内容配置
   * @returns {string} HTML字符串
   */
  private generateHtml(content: ContentConfig): string {
    const s = this.config;
    const itemBorder = s.itemBorder || `1px solid ${s.itemBorderColor}`;

    // 精简CSS
    const css = `
@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');
@import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');
:root {
  --accent: ${s.accentColor};
  --text: ${s.textColor};
  --bg: ${s.background};
  --item-bg: ${s.itemBackground};
  --header-bg: ${s.headerBackground};
  --header-text: ${s.headerColor};
  --footer-bg: ${s.footerBackground};
  --footer-text: ${s.footerColor};
  --subcmd-bg: ${s.subCommandBackground};
  --subcmd-border: ${s.subCommandBorderColor};
  --subcmd-icon: ${s.subCommandIconColor};
  --opt-bg: ${s.optionBackground};
  --opt-border: ${s.optionBorderColor};
  --opt-icon: ${s.optionIconColor};
}
body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:${s.fontFamily};font-size:${s.fontSize}px;}
.container{padding:15px;box-sizing:border-box;background:var(--bg);border-radius:${s.containerRadius}px;width:${s.width}px;}
.header,.footer{border-radius:${s.itemRadius}px;margin-bottom:12px;display:flex;align-items:center;}
.header{background:var(--header-bg);color:var(--header-text);padding:${s.headerPadding};}
.header-logo{height:28px;margin-right:8px;border-radius:4px;}
.header-title{font-size:1.1em;font-weight:600;margin:0;}
.grid-container{display:grid;width:100%;gap:${s.itemSpacing}px;grid-template-rows:repeat(${content.layout.rows},auto);grid-template-columns:repeat(${content.layout.cols},1fr);}
.grid-item{background:var(--item-bg);padding:${s.itemPadding};border-radius:${s.itemRadius}px;border:${itemBorder};box-shadow:${s.itemShadow};transition:transform .15s,box-shadow .15s;}
.grid-item:hover{transform:translateY(-1px);box-shadow:0 3px 6px rgba(0,0,0,0.08);}
.grid-item-header{display:flex;align-items:center;margin-bottom:6px;position:relative;}
.grid-item-title{font-weight:${s.titleWeight};font-size:${s.titleSize}em;margin:0 0 4px 0;color:${s.titleColor};}
.grid-item-icon{margin-right:6px;color:${s.iconColor};font-size:${s.iconSize}px;font-family:'Material Icons Round';}
.grid-item-content{line-height:${s.contentLineHeight};font-size:${s.contentSize}px;white-space:${s.contentWhiteSpace};max-height:${s.contentMaxHeight};overflow:${s.contentOverflow};}
.grid-item-badge{position:absolute;top:-6px;right:-6px;background:${s.badgeBackground||s.accentColor};color:${s.badgeColor};border-radius:999px;padding:${s.badgePadding};font-size:${s.badgeSize}em;font-weight:500;box-shadow:0 1px 2px rgba(0,0,0,0.12);}
.footer{margin-top:12px;text-align:center;background:var(--footer-bg);color:var(--footer-text);font-size:12px;justify-content:center;padding:${s.footerPadding};}
.grid-item.subCommand,.grid-item.option{position:relative;}
.grid-item.subCommand::before,.grid-item.option::before{content:'';position:absolute;left:-1px;top:0;bottom:0;width:3px;border-radius:2px;}
.grid-item.subCommand{background:var(--subcmd-bg);border-color:var(--subcmd-border);}
.grid-item.subCommand::before{background:var(--subcmd-icon);}
.grid-item.subCommand .grid-item-icon{color:var(--subcmd-icon);}
.grid-item.option{background:var(--opt-bg);border-color:var(--opt-border);}
.grid-item.option::before{background:var(--opt-icon);}
.grid-item.option .grid-item-icon{color:var(--opt-icon);}
.grid-item.title .grid-item-title{font-size:1.2em;color:var(--accent);font-weight:600;}`;

    // 构建HTML结构
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
    html += content.layout.items.map(item => {
      const style = `grid-row:${item.row}/span ${item.rowSpan || 1};grid-column:${item.col}/span ${item.colSpan || 1}`;
      const cls = item.itemType ? ` ${item.itemType}` : '';
      const id = item.id ? `id="${item.id}"` : '';
      return `<div class="grid-item${cls}" ${id} style="${style}">${this.renderGridItemContent(item)}</div>`;
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
   * 渲染网格项内容
   * @param {GridItem} item 网格项配置
   * @returns {string} HTML字符串
   */
  private renderGridItemContent(item: GridItem): string {
    const icon = item.icon && item.iconType === 'material'
      ? `<span class="grid-item-icon">${item.icon}</span>` : '';
    const badge = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : '';
    const title = item.title ? `<h3 class="grid-item-title">${escapeHtml(item.title)}</h3>` : '';
    const header = `<div class="grid-item-header">${icon}${badge}</div>${title}`;
    const content = item.type === 'image'
      ? `<img src="${item.content}" style="max-width:100%;" />`
      : `<div class="grid-item-content">${escapeHtml(item.content)}</div>`;

    return header + content;
  }

  /**
   * 渲染HTML为图片
   * @param {string} html HTML字符串
   * @returns {Promise<Buffer>} 图片buffer
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
