import type { Config } from './index'

export interface ThemeConfig {
  themePreset: 'light' | 'dark' | 'glass' | 'custom'
  spacing: { outer: number; inner: number; item: number; itemGap: number; container: number }
  visual: { backgroundImage: string; roundness: number; shadowBlur: number; shadowSpread: number; backdropBlur: number; enableGlass: boolean }
  typography: { fontFamily: string; fontUrl: string; fontSize: number; titleSize: number; titleWeight: string; lineHeight: number }
  display: { headerText: string; footerText: string }
  colors: { primary: string; background: string; text: string; secondary: string; accent: string; surface: string; textSecondary: string; border: string; shadow: string }
}

export interface ComputedTheme {
  colors: Record<string, string>
  typography: { fontFamily: string; fontSize: number; titleSize: number; titleWeight: string; lineHeight: number }
  spacing: { itemPadding: string; itemSpacing: number; containerPadding: string }
  effects: { shadow: string; borderStyle: string; backdropBlur: number; enableGlass: boolean }
  outerPadding: number
  innerPadding: number
  backgroundImage: string
  backgroundImagePath?: string
  borderRadius: string
  fontUrl?: string
  header: { show: boolean; text: string }
  footer: { show: boolean; text: string }
}

/**
 * 主题管理器 - 处理主题样式和渲染
 */
export class ThemeManager {
  private readonly presetColors = {
    light: {
      primary: '#2563eb', secondary: '#64748b', accent: '#0ea5e9',
      background: '#ffffff', surface: '#f8fafc', text: '#1e293b',
      textSecondary: '#64748b', border: 'rgba(148, 163, 184, 0.2)', shadow: 'rgba(0, 0, 0, 0.08)'
    },
    dark: {
      primary: '#ffffff', secondary: '#666666', accent: '#888888',
      background: '#000000', surface: '#111111', text: '#ffffff',
      textSecondary: '#888888', border: 'rgba(255, 255, 255, 0.1)', shadow: 'rgba(0, 0, 0, 0.8)'
    }
  }

  /**
   * 获取计算后的主题配置
   */
  async getComputedTheme(config: Config, fileManager?: any): Promise<ComputedTheme> {
    const preset = config.themePreset || 'light'
    const baseColors = this.presetColors[preset === 'custom' ? 'light' : preset]
    // 合并颜色配置
    const colors = {
      ...baseColors,
      ...(config.primaryColor && { primary: config.primaryColor }),
      ...(config.backgroundColor && { background: config.backgroundColor }),
      ...(config.textColor && { text: config.textColor }),
      ...(config.secondaryColor && { secondary: config.secondaryColor }),
      ...(config.accentColor && { accent: config.accentColor }),
      ...(config.surfaceColor && { surface: config.surfaceColor }),
      ...(config.textSecondaryColor && { textSecondary: config.textSecondaryColor }),
      ...(config.borderColor && { border: config.borderColor }),
      ...(config.shadowColor && { shadow: config.shadowColor })
    }
    // 处理资源文件
    const [backgroundImage, fontUrl] = await Promise.all([
      this.resolveAsset(config.backgroundImage, fileManager),
      this.resolveAsset(config.fontUrl, fileManager)
    ])
    // 构建阴影效果
    const shadowBlur = config.shadowBlur ?? 8
    const shadowSpread = config.shadowSpread ?? 2
    const shadow = preset === 'dark'
      ? `0 ${shadowSpread * 2}px ${shadowBlur * 1.5}px ${colors.shadow}, 0 ${shadowSpread}px ${shadowBlur / 2}px ${colors.shadow}`
      : `0 ${shadowSpread}px ${shadowBlur}px ${colors.shadow}, 0 ${shadowSpread / 2}px ${shadowBlur / 2}px ${colors.shadow}`
    return {
      colors,
      typography: {
        fontFamily: config.fontFamily || "'Inter', 'SF Pro Display', 'Noto Sans SC', system-ui, sans-serif",
        fontSize: config.fontSize ?? 16,
        titleSize: config.titleSize ?? 1.25,
        titleWeight: config.titleWeight ?? '600',
        lineHeight: config.lineHeight ?? 1.5
      },
      spacing: {
        itemPadding: `${config.itemPadding ?? 16}px`,
        itemSpacing: config.itemSpacing ?? 12,
        containerPadding: `${config.containerPadding ?? 20}px`
      },
      effects: {
        shadow,
        borderStyle: '1px solid',
        backdropBlur: config.backdropBlur ?? 20,
        enableGlass: config.enableGlassEffect ?? false
      },
      outerPadding: config.outerPadding ?? 20,
      innerPadding: config.innerPadding ?? 12,
      backgroundImage: backgroundImage.url,
      backgroundImagePath: backgroundImage.path,
      borderRadius: `${config.roundness ?? 12}px`,
      fontUrl: fontUrl.url,
      header: { show: !!(config.headerText?.trim()), text: config.headerText?.trim() || '' },
      footer: { show: !!(config.footerText?.trim()), text: config.footerText?.trim() || '' }
    }
  }

  /**
   * 解析资源文件路径
   */
  private async resolveAsset(asset: string, fileManager?: any): Promise<{ url: string; path?: string }> {
    if (!asset) return { url: '' }
    if (asset.startsWith('http')) return { url: asset }
    if (fileManager && await fileManager.load('asset', asset)) {
      const assetPath = fileManager.getFilePath('asset', asset)
      return { url: `file://${assetPath}`, path: assetPath }
    }
    return { url: '' }
  }

  /**
   * 生成默认CSS模板
   */
  generateDefaultCssTemplate(theme: ComputedTheme): string {
    const backgroundStyles = theme.backgroundImage
      ? `background-image: url('${theme.backgroundImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;`
      : `background: ${theme.colors.background};`
    const fontImport = theme.fontUrl ? `@import url('${theme.fontUrl}');` : ''
    const glassEffect = theme.effects.enableGlass ? this.generateGlassEffect(theme) : ''
    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
      @import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');
      ${fontImport}
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: ${theme.typography.fontFamily}; font-size: ${theme.typography.fontSize}px;
             line-height: ${theme.typography.lineHeight}; color: ${theme.colors.text}; ${backgroundStyles}
             -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
             padding: ${theme.outerPadding}px; }

      .container { max-width: fit-content; min-width: 320px; padding: ${theme.spacing.containerPadding};
                  position: relative; border-radius: ${theme.borderRadius}; background: ${theme.colors.surface};
                  box-shadow: ${theme.effects.shadow}; margin: 0 auto; }
      ${glassEffect}
      ${this.generateLayoutStyles(theme)}
      ${this.generateGridStyles(theme)}
      ${this.generateItemStyles(theme)}
    `
  }

  /**
   * 生成毛玻璃效果CSS
   */
  private generateGlassEffect(theme: ComputedTheme): string {
    return `
      .container { backdrop-filter: blur(${theme.effects.backdropBlur}px); -webkit-backdrop-filter: blur(${theme.effects.backdropBlur}px); }
      .grid-item, .header, .footer { backdrop-filter: blur(${theme.effects.backdropBlur * 0.6}px); -webkit-backdrop-filter: blur(${theme.effects.backdropBlur * 0.6}px); }
    `
  }

  /**
   * 生成布局样式CSS
   */
  private generateLayoutStyles(theme: ComputedTheme): string {
    return `
      .header, .footer { border-radius: ${theme.borderRadius}; position: relative; z-index: 1; width: 100%; }
      .header { background: linear-gradient(135deg, ${theme.colors.surface}, ${theme.colors.background});
               color: ${theme.colors.text}; padding: ${theme.spacing.itemPadding}; text-align: center;
               border: ${theme.effects.borderStyle} ${theme.colors.border}; box-shadow: ${theme.effects.shadow};
               font-weight: 600; display: flex; align-items: center; justify-content: center;
               margin-bottom: ${theme.innerPadding}px; }
      .footer { text-align: center; background: ${theme.colors.surface}; color: ${theme.colors.textSecondary};
               font-size: 13px; padding: 16px; border: ${theme.effects.borderStyle} ${theme.colors.border};
               opacity: 0.7; font-weight: 500; display: flex; align-items: center; justify-content: center; }
    `
  }

  /**
   * 生成网格样式CSS
   */
  private generateGridStyles(theme: ComputedTheme): string {
    return `
      .grid-container { display: grid; width: 100%; gap: ${theme.spacing.itemSpacing}px; position: relative; z-index: 1;
                       grid-template-rows: repeat(var(--grid-rows), auto); grid-template-columns: repeat(var(--grid-cols), 1fr);
                       margin-bottom: ${theme.innerPadding}px; }
      .grid-container:last-child { margin-bottom: 0; }
    `
  }

  /**
   * 生成项目样式CSS
   */
  private generateItemStyles(theme: ComputedTheme): string {
    return `
      .grid-item { background: ${theme.colors.surface}; padding: ${theme.spacing.itemPadding}; border-radius: ${theme.borderRadius};
                  border: ${theme.effects.borderStyle} ${theme.colors.border}; box-shadow: ${theme.effects.shadow};
                  position: relative; overflow: hidden; min-width: 200px; }
      .grid-item-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; position: relative; }
      .grid-item-title { font-weight: ${theme.typography.titleWeight}; font-size: ${theme.typography.titleSize}em;
                        margin: 0; color: ${theme.colors.primary}; letter-spacing: -0.02em; }
      .grid-item-icon { color: ${theme.colors.primary}; font-size: 22px; font-family: 'Material Icons Round';
                       margin-right: 10px; opacity: 0.8; }
      .grid-item-content { line-height: ${theme.typography.lineHeight}; color: ${theme.colors.textSecondary};
                          white-space: pre-wrap; font-size: 0.95em; }
      .grid-item-badge { position: absolute; top: -8px; right: -8px; background: ${theme.colors.accent};
                        color: ${theme.colors.surface}; border-radius: 16px; padding: 4px 10px;
                        font-size: 0.7em; font-weight: 700; box-shadow: ${theme.effects.shadow};
                        letter-spacing: 0.5px; }
      .grid-item.subCommand::before, .grid-item.option::before {
        content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 4px;
        border-radius: 0 ${theme.borderRadius} ${theme.borderRadius} 0;
      }
      .grid-item.subCommand::before { background: linear-gradient(180deg, ${theme.colors.secondary}, ${theme.colors.primary}); }
      .grid-item.option::before { background: linear-gradient(180deg, ${theme.colors.accent}, ${theme.colors.secondary}); }
      .grid-item.title .grid-item-title { font-size: 1.4em; color: ${theme.colors.primary}; text-align: center;
                                         font-weight: 700; letter-spacing: -0.03em; }
      .grid-item.title { background: linear-gradient(135deg, ${theme.colors.primary}12, ${theme.colors.secondary}08);
                        border: 2px solid ${theme.colors.primary}20; }
      .grid-item.command { background: linear-gradient(135deg, ${theme.colors.surface}, ${theme.colors.background}); }
    `
  }

  /**
   * 生成默认HTML模板
   */
  generateDefaultHtmlTemplate(): string {
    return `<!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"><style>{{CSS_CONTENT}}</style></head>
    <body>
      <div class="container" style="--grid-rows: {{GRID_ROWS}}; --grid-cols: {{GRID_COLS}};">
        {{HEADER_CONTENT}}
        <div class="grid-container">{{GRID_CONTENT}}</div>
        {{FOOTER_CONTENT}}
      </div>
    </body>
    </html>`
  }
}