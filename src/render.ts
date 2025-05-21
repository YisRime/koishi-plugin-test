import { Context } from 'koishi'
import {} from 'koishi-plugin-puppeteer'
import { logger } from './index'
import { join } from 'path'
import { existsSync } from 'fs'
import { File } from './utils'

// 网格项配置
export interface GridItem {
  row: number
  col: number
  rowSpan?: number
  colSpan?: number
  type: 'text' | 'image' | 'custom'
  content: string
  style?: Record<string, any>
}

// 渲染配置
export interface RenderConfig {
  header: { show: boolean; title?: string; logo?: string }
  footer: { show: boolean; text?: string }
  layout: { rows: number; cols: number; gap?: number; items: GridItem[] }
  style?: { width?: number; background?: string }
}

/**
 * 帮助渲染器类
 */
export class Renderer {
  private configPath: string;
  private fileManager: File;

  constructor(private ctx: Context, defaultConfig: Partial<RenderConfig> = {}) {
    const dataDir = join(ctx.baseDir, 'data/test');
    this.configPath = join(dataDir, 'default.json');
    this.fileManager = new File(dataDir);

    // 初始化
    this.fileManager.ensureDir(dataDir).then(() => {
      if (!existsSync(this.configPath)) {
        const config = { ...Renderer.getDefaultConfig(), ...defaultConfig };
        this.fileManager.writeFile(this.configPath, JSON.stringify(config, null, 2))
          .then(success => success && logger.info('已创建默认渲染配置模板'));
      }
    });
  }

  /**
   * 获取默认配置
   */
  static getDefaultConfig(): RenderConfig {
    return {
      header: {
        show: true,
        title: 'Koishi 帮助中心',
        logo: 'https://koishi.chat/logo.png'
      },
      footer: {
        show: true,
        text: 'Powered by Koishi'
      },
      layout: {
        rows: 3,
        cols: 2,
        gap: 15,
        items: [
          {
            row: 1, col: 1, colSpan: 2, type: 'text',
            content: '欢迎使用Koishi帮助系统！',
            style: { 'font-size': '16px', 'font-weight': 'bold', 'text-align': 'center', 'padding': '20px' }
          },
          {
            row: 2, col: 1, type: 'text',
            content: '这是一个示例文本块',
            style: { 'background-color': '#f8f8f8' }
          },
          {
            row: 2, col: 2, type: 'image',
            content: 'https://koishi.chat/logo.png',
            style: { 'text-align': 'center', 'padding': '10px' }
          },
          {
            row: 3, col: 1, colSpan: 2, type: 'text',
            content: '您可以修改data/test/default.json来自定义此模板',
            style: { 'font-style': 'italic', 'text-align': 'center', 'color': '#666' }
          }
        ]
      },
      style: {
        width: 800,
        background: '#ffffff'
      }
    };
  }

  /**
   * 加载渲染配置
   */
  public async loadConfig(): Promise<RenderConfig> {
    try {
      const content = await this.fileManager.readFile(this.configPath);
      return content ? JSON.parse(content) : Renderer.getDefaultConfig();
    } catch {
      logger.warn('加载配置失败，使用默认配置');
      return Renderer.getDefaultConfig();
    }
  }

  /**
   * 渲染帮助图片
   */
  public async render(customConfig?: Partial<RenderConfig>): Promise<Buffer> {
    try {
      // 加载并合并配置
      const config = this.mergeConfig(customConfig || await this.loadConfig());

      // 生成HTML和渲染图片
      return await this.renderHtml(this.generateHtml(config));
    } catch (err) {
      logger.error('渲染帮助图片失败', err);
      throw err;
    }
  }

  /**
   * 合并配置
   */
  private mergeConfig(config: Partial<RenderConfig>): RenderConfig {
    const defaults = Renderer.getDefaultConfig();
    return {
      header: { ...defaults.header, ...config.header },
      footer: { ...defaults.footer, ...config.footer },
      layout: {
        rows: config.layout?.rows ?? defaults.layout.rows,
        cols: config.layout?.cols ?? defaults.layout.cols,
        gap: config.layout?.gap ?? defaults.layout.gap,
        items: config.layout?.items ?? defaults.layout.items
      },
      style: {
        width: config.style?.width ?? defaults.style.width,
        background: config.style?.background ?? defaults.style.background
      }
    };
  }

  /**
   * 生成HTML
   */
  private generateHtml(config: RenderConfig): string {
    // 生成CSS样式
    const css = `
.container {
  font-family: Arial, sans-serif;
  background-color: ${config.style.background};
  padding: 20px;
  box-sizing: border-box;
}
.header {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 8px;
  margin-bottom: 20px;
}
.header-logo { height: 50px; margin-right: 15px; }
.header-title { font-size: 24px; color: #333; margin: 0; }
.grid-container {
  display: grid;
  width: 100%;
  gap: ${config.layout.gap}px;
  grid-template-rows: repeat(${config.layout.rows}, auto);
  grid-template-columns: repeat(${config.layout.cols}, 1fr);
}
.grid-item {
  background-color: #f9f9f9;
  padding: 15px;
  border-radius: 5px;
  border: 1px solid #e0e0e0;
}
.grid-item-text { line-height: 1.5; }
.grid-item-image { max-width: 100%; display: block; margin: 0 auto; }
.footer {
  margin-top: 20px;
  text-align: center;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 8px;
  font-size: 14px;
  color: #666;
}`;

    // 构建HTML
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>${css}</style></head><body>
<div class="container" style="width: ${config.style.width}px;">`;

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
      html += `<div class="grid-item" style="${itemStyle.join('; ')}">${content}</div>`;
    }

    html += `</div>`;

    // 添加页脚
    if (config.footer?.show) {
      html += `<div class="footer"><div class="footer-text">${config.footer.text || ''}</div></div>`;
    }

    html += `</div></body></html>`;
    return html;
  }

  /**
   * 处理网格项内容
   */
  private renderGridItemContent(item: GridItem): string {
    switch (item.type) {
      case 'text': return `<div class="grid-item-text">${item.content}</div>`;
      case 'image': return `<img src="${item.content}" class="grid-item-image" />`;
      default: return `<div class="grid-item-custom">${item.content}</div>`;
    }
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
