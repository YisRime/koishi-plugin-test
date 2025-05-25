import { logger } from './index'

export interface ThemeConfig {
  themePreset: 'light' | 'dark' | 'glass' | 'custom'
  width?: number
  backgroundImage?: string
  roundness?: number
  headerText?: string
  footerText?: string
  primaryColor?: string
  backgroundColor?: string
  textColor?: string
}

interface ThemeStyle {
  name: string
  colors: Record<string, string>
  typography: {
    fontFamily: string
    fontSize: number
    titleSize: number
    titleWeight: string
    lineHeight: number
  }
  spacing: {
    itemPadding: string
    itemSpacing: number
    containerPadding: string
  }
  effects: {
    shadow: string
    hoverTransform: string
    borderStyle: string
  }
}

export interface ComputedTheme extends ThemeStyle {
  width: number
  backgroundImage: string
  borderRadius: string
  header: {
    show: boolean
    text: string
  }
  footer: {
    show: boolean
    text: string
  }
}

/**
 * 主题管理器 - 处理主题样式和渲染
 */
export class ThemeManager {
  private readonly presetStyles: Record<string, ThemeStyle>
  private readonly commonConfig = {
    typography: {
      fontFamily: "'Inter', 'SF Pro Display', 'Noto Sans SC', system-ui, sans-serif",
      fontSize: 16,
      titleSize: 1.25,
      titleWeight: '600',
      lineHeight: 1.5
    },
    effects: {
      hoverTransform: 'translateY(-2px)',
      borderStyle: '1px solid'
    }
  }

  constructor() {
    this.presetStyles = this.initializePresetStyles()
  }

  /**
   * 初始化预设样式
   */
  private initializePresetStyles(): Record<string, ThemeStyle> {
    return {
      light: {
        name: '浅色主题',
        colors: {
          primary: '#2563eb', secondary: '#64748b', accent: '#0ea5e9',
          background: '#ffffff', surface: '#f8fafc', text: '#1e293b',
          textSecondary: '#64748b', border: 'rgba(148, 163, 184, 0.2)', shadow: 'rgba(0, 0, 0, 0.08)'
        },
        typography: this.commonConfig.typography,
        spacing: {
          itemPadding: '16px', itemSpacing: 12, containerPadding: '20px'
        },
        effects: {
          ...this.commonConfig.effects,
          shadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)'
        }
      },

      dark: {
        name: '深色主题',
        colors: {
          primary: '#ffffff', secondary: '#666666', accent: '#888888',
          background: '#000000', surface: '#111111', text: '#ffffff',
          textSecondary: '#888888', border: 'rgba(255, 255, 255, 0.1)', shadow: 'rgba(0, 0, 0, 0.8)'
        },
        typography: this.commonConfig.typography,
        spacing: {
          itemPadding: '16px', itemSpacing: 12, containerPadding: '20px'
        },
        effects: {
          ...this.commonConfig.effects,
          shadow: '0 4px 12px rgba(0, 0, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.4)'
        }
      },

      glass: {
        name: '毛玻璃风格',
        colors: {
          primary: '#a855f7', secondary: '#06b6d4', accent: '#f59e0b',
          background: 'rgba(15, 23, 42, 0.8)', surface: 'rgba(30, 41, 59, 0.6)',
          text: '#f1f5f9', textSecondary: 'rgba(241, 245, 249, 0.8)',
          border: 'rgba(148, 163, 184, 0.3)', shadow: 'rgba(0, 0, 0, 0.4)'
        },
        typography: this.commonConfig.typography,
        spacing: {
          itemPadding: '18px', itemSpacing: 14, containerPadding: '22px'
        },
        effects: {
          shadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2)',
          hoverTransform: 'translateY(-3px)',
          borderStyle: '1px solid'
        }
      }
    }
  }

  /**
   * 获取计算后的主题配置
   * @param config 主题配置
   */
  getComputedTheme(config: ThemeConfig): ComputedTheme {
    const preset = config.themePreset || 'light'

    // 获取预设样式作为基础
    const baseStyle = this.presetStyles[preset === 'custom' ? 'light' : preset]

    logger.debug(`使用主题: ${preset}`)

    // 构建自定义颜色，用户配置覆盖预设
    const customColors: Record<string, string> = { ...baseStyle.colors }
    if (config.primaryColor) customColors.primary = config.primaryColor
    if (config.backgroundColor) customColors.background = config.backgroundColor
    if (config.textColor) customColors.text = config.textColor

    // 处理显示配置
    const header = {
      show: !!(config.headerText?.trim()),
      text: config.headerText?.trim() || ''
    }

    const footer = {
      show: !!(config.footerText?.trim()),
      text: config.footerText?.trim() || ''
    }

    // 处理圆角
    const borderRadius = config.roundness !== undefined ? `${config.roundness}px` : '12px'

    // 所有主题都支持配置覆盖
    return {
      ...baseStyle,
      width: config.width ?? 480,
      backgroundImage: config.backgroundImage ?? '',
      borderRadius,
      header,
      footer,
      colors: customColors
    }
  }

  /**
   * 生成默认CSS模板
   * @param theme 主题对象
   */
  generateDefaultCssTemplate(theme: ComputedTheme): string {
    const backgroundStyles = theme.backgroundImage ?
      `background-image: url('${theme.backgroundImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;` :
      `background: ${theme.colors.background};`

    const glassEffect = theme.name === '毛玻璃风格' ? `
      .container { backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
      .grid-item, .header, .footer { backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
    ` : ''

    return `
      @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap');
      @import url('https://fonts.googleapis.com/icon?family=Material+Icons+Round');

      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: ${theme.typography.fontFamily}; font-size: ${theme.typography.fontSize}px;
             line-height: ${theme.typography.lineHeight}; color: ${theme.colors.text}; ${backgroundStyles}
             -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }

      .container { width: ${theme.width}px; padding: ${theme.spacing.containerPadding}; position: relative;
                  border-radius: ${theme.borderRadius}; background: ${theme.colors.surface};
                  box-shadow: ${theme.effects.shadow}; }
      ${glassEffect}

      .header, .footer { border-radius: ${theme.borderRadius}; margin-bottom: ${theme.spacing.itemSpacing}px;
                        display: flex; align-items: center; position: relative; z-index: 1; width: 100%; }

      .header { background: ${theme.colors.surface}; color: ${theme.colors.text}; padding: ${theme.spacing.itemPadding};
               border: ${theme.effects.borderStyle} ${theme.colors.border}; box-shadow: ${theme.effects.shadow};
               background: linear-gradient(135deg, ${theme.colors.surface}, ${theme.colors.background});
               text-align: center; justify-content: center; font-weight: 600; }

      .grid-container { display: grid; width: 100%; gap: ${theme.spacing.itemSpacing}px; position: relative; z-index: 1;
                       grid-template-rows: repeat(var(--grid-rows), auto); grid-template-columns: repeat(var(--grid-cols), 1fr); }

      .grid-item { background: ${theme.colors.surface}; padding: ${theme.spacing.itemPadding}; border-radius: ${theme.borderRadius};
                  border: ${theme.effects.borderStyle} ${theme.colors.border}; box-shadow: ${theme.effects.shadow};
                  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); position: relative; overflow: hidden; }
      .grid-item:hover { transform: ${theme.effects.hoverTransform};
                        box-shadow: 0 12px 32px ${theme.colors.shadow}, 0 4px 16px ${theme.colors.shadow}; }

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

      .footer { margin-top: ${theme.spacing.itemSpacing}px; text-align: center; background: ${theme.colors.surface};
               color: ${theme.colors.textSecondary}; font-size: 13px; justify-content: center; padding: 16px;
               border: ${theme.effects.borderStyle} ${theme.colors.border}; opacity: 0.7; font-weight: 500; }

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
      .grid-item.command:hover { background: linear-gradient(135deg, ${theme.colors.primary}08, ${theme.colors.surface}); }
    `
  }

  /**
   * 生成默认HTML模板
   */
  generateDefaultHtmlTemplate(): string {
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>{{CSS_CONTENT}}</style>
</head>
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