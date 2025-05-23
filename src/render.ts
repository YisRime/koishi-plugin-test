import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { logger } from './index'
import { Config } from './index'

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
 * 帮助渲染器类
 * @class Renderer
 */
export class Renderer {
  /**
   * 创建渲染器实例
   * @param {Context} ctx Koishi上下文
   * @param {Config} config 配置
   */
  constructor(private ctx: Context, private config: Config) {}

  /**
   * 渲染帮助图片
   * @param {ContentConfig} content 内容配置
   * @returns {Promise<Buffer>} 图片buffer
   */
  public async render(content: ContentConfig): Promise<Buffer> {
    if (!content) throw new Error('渲染内容配置为空');
    try {
      const html = this.generateHtml(content);
      return await this.renderHtml(html);
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
    const it = s.itemStyle || {};
    const tx = s.textStyle || {};
    const ic = s.iconStyle || {};
    const headerBg = s.header?.background || '#ede7f6';
    const headerColor = s.header?.color || '#311b92';
    const footerBg = s.footer?.background || '#e0e0e0';
    const footerColor = s.footer?.color || '#616161';
    const subCmd = s.specialStyles?.subCommand || {};
    const opt = s.specialStyles?.option || {};

    // 精简CSS
    const css = `@import url('https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Noto+Sans+SC:wght@400;500;700&display=swap');@import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');:root{--accent:${s.accentColor || '#6750a4'};--text:${s.textColor || '#1c1b1f'};--bg:${s.background || '#ffffff'};--item-bg:${it.background || '#ffffff'};--header-bg:${headerBg};--header-text:${headerColor};--footer-bg:${footerBg};--footer-text:${footerColor};--subcmd-bg:${subCmd.background || '#f8f0fc'};--subcmd-border:${subCmd.borderColor || '#d0bfff'};--subcmd-icon:${subCmd.iconColor || '#9c27b0'};--opt-bg:${opt.background || '#f1f5fe'};--opt-border:${opt.borderColor || '#bbdefb'};--opt-icon:${opt.iconColor || '#1565c0'}}body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:${s.fontFamily || "'Roboto', 'Noto Sans SC', sans-serif"};font-size:${s.fontSize || 14}px}.container{padding:15px;box-sizing:border-box;background:var(--bg);width:${s.width || 800}px}.header,.footer{border-radius:${it.radius || 12}px;margin-bottom:12px;display:flex;align-items:center}.header{background:var(--header-bg);color:var(--header-text);padding:12px}.header-logo{height:28px;margin-right:8px;border-radius:4px}.header-title{font-size:1.1em;font-weight:600;margin:0}.grid-container{display:grid;width:100%;gap:${it.spacing || 10}px;grid-template-rows:repeat(${content.layout.rows},auto);grid-template-columns:repeat(${content.layout.cols},1fr)}.grid-item{background:var(--item-bg);padding:${it.padding || '12px'};border-radius:${it.radius || 12}px;border:1px solid ${it.borderColor || 'rgba(0,0,0,0.08)'};box-shadow:${it.shadow || '0 1px 4px rgba(0,0,0,0.05)'};transition:transform .15s,box-shadow .15s}.grid-item:hover{transform:translateY(-1px);box-shadow:0 3px 6px rgba(0,0,0,0.08)}.grid-item-header{display:flex;align-items:center;margin-bottom:6px;position:relative}.grid-item-title{font-weight:${tx.titleWeight || '600'};font-size:${tx.titleSize || 1.1}em;margin:0 0 4px 0;color:${tx.titleColor || 'inherit'}}.grid-item-icon{margin-right:6px;color:${ic.color || '#6750a4'};font-size:${ic.size || 20}px;font-family:'Material Icons Round'}.grid-item-content{line-height:${tx.lineHeight || 1.5};font-size:${tx.contentSize || 14}px;white-space:${tx.whiteSpace || 'pre-wrap'}}.grid-item-badge{position:absolute;top:-6px;right:-6px;background:var(--accent);color:${ic.badgeColor || 'white'};border-radius:999px;padding:2px 6px;font-size:${ic.badgeSize || 0.75}em;font-weight:500}.footer{margin-top:12px;text-align:center;background:var(--footer-bg);color:var(--footer-text);font-size:12px;justify-content:center;padding:10px}.grid-item.subCommand,.grid-item.option{position:relative}.grid-item.subCommand::before,.grid-item.option::before{content:'';position:absolute;left:-1px;top:0;bottom:0;width:3px;border-radius:2px}.grid-item.subCommand{background:var(--subcmd-bg);border-color:var(--subcmd-border)}.grid-item.subCommand::before{background:var(--subcmd-icon)}.grid-item.subCommand .grid-item-icon{color:var(--subcmd-icon)}.grid-item.option{background:var(--opt-bg);border-color:var(--opt-border)}.grid-item.option::before{background:var(--opt-icon)}.grid-item.option .grid-item-icon{color:var(--opt-icon)}.grid-item.title .grid-item-title{font-size:1.2em;color:var(--accent);font-weight:600}`;

    // 构建HTML内容
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body><div class="container">`;

    // 添加页眉
    if (content.header?.show) {
      html += `<div class="header">
        ${content.header.logo ? `<img src="${content.header.logo}" class="header-logo" />` : ''}
        <h1 class="header-title">${this.escapeHtml(content.header.title || '')}</h1>
      </div>`;
    }

    // 添加网格内容
    html += `<div class="grid-container">`;

    // 内联renderGridItem函数
    html += content.layout.items.map(item => {
      const style = `grid-row:${item.row}/span ${item.rowSpan || 1};grid-column:${item.col}/span ${item.colSpan || 1}`;
      const cls = item.itemType ? ` ${item.itemType}` : '';
      const id = item.id ? `id="${item.id}"` : '';

      const icon = item.icon && item.iconType === 'material'
        ? `<span class="grid-item-icon">${item.icon}</span>` : '';
      const badge = item.badge ? `<span class="grid-item-badge">${item.badge}</span>` : '';
      const title = item.title ? `<h3 class="grid-item-title">${this.escapeHtml(item.title)}</h3>` : '';

      const headerHtml = `<div class="grid-item-header">${icon}${badge}</div>${title}`;
      const contentHtml = item.type === 'image'
        ? `<img src="${item.content}" style="max-width:100%;" />`
        : `<div class="grid-item-content">${this.escapeHtml(item.content)}</div>`;

      return `<div class="grid-item${cls}" ${id} style="${style}">${headerHtml}${contentHtml}</div>`;
    }).join('');

    html += `</div>`;

    // 添加页脚
    if (content.footer?.show) {
      html += `<div class="footer">${this.escapeHtml(content.footer.text || '')}</div>`;
    }

    html += `</div></body></html>`;
    return html;
  }

  /**
   * HTML转义
   */
  private escapeHtml(unsafe: any): string {
    if (unsafe === null || unsafe === undefined) return '';
    return String(unsafe)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  /**
   * 渲染HTML为图片
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
