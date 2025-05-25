import { logger } from './index'
import { LayoutConfig } from './content'
import { FileManager } from './utils'

export interface ThemeConfig {
  width?: number
  backgroundImage?: string
  backgroundOverlay?: string
  style?: 'light' | 'dark' | 'glass'
  roundness?: 'none' | 'small' | 'medium' | 'large'
  headerShow?: boolean
  headerLogo?: string
  footerShow?: boolean
  footerText?: string
  customColors?: {
    primary?: string
    background?: string
    text?: string
  }
}

interface ThemeStyle {
  name: string
  description: string
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

/**
 * 主题管理器 - 处理主题样式和渲染
 */
export class ThemeManager {
  private readonly presetStyles: Record<string, ThemeStyle>
  private fileManager?: FileManager

  constructor(baseDir?: string) {
    this.presetStyles = this.initializePresetStyles()
    if (baseDir) this.fileManager = new FileManager(baseDir)
  }

  /**
   * 初始化预设样式
   */
  private initializePresetStyles(): Record<string, ThemeStyle> {
    const createStyle = (name: string, description: string, colors: Record<string, string>,
                        typography: any, spacing: any, effects: any): ThemeStyle => ({
      name, description, colors, typography, spacing, effects
    })

    return {
      light: createStyle('浅色主题', '简洁明亮的浅色设计', {
        primary: '#2563eb', secondary: '#64748b', accent: '#0ea5e9',
        background: '#ffffff', surface: '#f8fafc', text: '#1e293b',
        textSecondary: '#64748b', border: 'rgba(148, 163, 184, 0.2)', shadow: 'rgba(0, 0, 0, 0.08)'
      }, {
        fontFamily: "'Inter', 'SF Pro Display', 'Noto Sans SC', system-ui, sans-serif",
        fontSize: 16, titleSize: 1.25, titleWeight: '600', lineHeight: 1.5
      }, {
        itemPadding: '16px', itemSpacing: 12, containerPadding: '20px'
      }, {
        shadow: '0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
        hoverTransform: 'translateY(-2px)', borderStyle: '1px solid'
      }),

      dark: createStyle('深色主题', '纯黑护眼的深色设计', {
        primary: '#ffffff', secondary: '#666666', accent: '#888888',
        background: '#000000', surface: '#111111', text: '#ffffff',
        textSecondary: '#888888', border: 'rgba(255, 255, 255, 0.1)', shadow: 'rgba(0, 0, 0, 0.8)'
      }, {
        fontFamily: "'Inter', 'SF Pro Display', 'Noto Sans SC', system-ui, sans-serif",
        fontSize: 16, titleSize: 1.25, titleWeight: '600', lineHeight: 1.5
      }, {
        itemPadding: '16px', itemSpacing: 12, containerPadding: '20px'
      }, {
        shadow: '0 4px 12px rgba(0, 0, 0, 0.8), 0 2px 6px rgba(0, 0, 0, 0.4)',
        hoverTransform: 'translateY(-2px)', borderStyle: '1px solid'
      }),

      glass: createStyle('毛玻璃风格', '现代毛玻璃效果', {
        primary: '#a855f7', secondary: '#06b6d4', accent: '#f59e0b',
        background: 'rgba(15, 23, 42, 0.8)', surface: 'rgba(30, 41, 59, 0.6)',
        text: '#f1f5f9', textSecondary: 'rgba(241, 245, 249, 0.8)',
        border: 'rgba(148, 163, 184, 0.3)', shadow: 'rgba(0, 0, 0, 0.4)'
      }, {
        fontFamily: "'Inter', 'SF Pro Display', 'Noto Sans SC', system-ui, sans-serif",
        fontSize: 16, titleSize: 1.25, titleWeight: '600', lineHeight: 1.5
      }, {
        itemPadding: '18px', itemSpacing: 14, containerPadding: '22px'
      }, {
        shadow: '0 8px 32px rgba(0, 0, 0, 0.4), 0 4px 16px rgba(0, 0, 0, 0.2)',
        hoverTransform: 'translateY(-3px)', borderStyle: '1px solid'
      })
    }
  }

  /**
   * 获取计算后的主题配置
   * @param config 主题配置
   */
  getComputedTheme(config: ThemeConfig): any {
    const style = this.presetStyles[config.style || 'light']
    const roundnessMap = { none: '0px', small: '8px', medium: '12px', large: '16px' }

    return {
      ...style,
      width: config.width || 480,
      backgroundImage: config.backgroundImage || '',
      backgroundOverlay: config.backgroundOverlay || '',
      borderRadius: roundnessMap[config.roundness || 'medium'],
      headerShow: config.headerShow ?? true,
      headerLogo: config.headerLogo || '',
      footerShow: config.footerShow ?? true,
      footerText: config.footerText || 'Powered by Koishi',
      colors: {
        ...style.colors,
        ...config.customColors
      }
    }
  }

  /**
   * 加载主题配置
   * @param themeName 主题名称
   */
  async loadTheme(themeName: string): Promise<ThemeConfig> {
    const defaultTheme: ThemeConfig = {
      width: 480, style: (themeName as any) || 'light', roundness: 'medium',
      headerShow: true, footerShow: true, footerText: 'Powered by Koishi'
    }

    // 如果没有文件管理器，直接返回默认配置
    if (!this.fileManager) {
      logger.debug(`使用默认主题配置: ${themeName}`)
      return defaultTheme
    }

    // 如果是预设主题名称，优先使用预设配置而不创建文件
    if (this.presetStyles[themeName]) {
      logger.debug(`使用预设主题: ${themeName}`)
      return {
        ...defaultTheme,
        style: themeName as any
      }
    }

    // 对于自定义主题，检查文件是否存在
    if (!this.fileManager.exists('theme', themeName)) {
      await this.createSampleTheme(themeName)
    }

    const customTheme = await this.fileManager.load<ThemeConfig>('theme', themeName)
    if (customTheme) {
      logger.debug(`加载自定义主题: ${themeName}`)
      return customTheme
    }

    logger.debug(`使用默认主题配置: ${themeName}`)
    return defaultTheme
  }

  /**
   * 创建主题样本
   * @param themeName 主题名称
   */
  private async createSampleTheme(themeName: string): Promise<boolean> {
    const sampleTheme: ThemeConfig = {
      width: 480, style: 'light', roundness: 'medium',
      backgroundImage: '', backgroundOverlay: 'rgba(0, 0, 0, 0.1)',
      headerShow: true, headerLogo: '',
      footerShow: true, footerText: 'Custom Theme',
      customColors: { primary: '#2563eb', background: '#ffffff', text: '#1e293b' }
    }

    const success = await this.fileManager!.save('theme', themeName, sampleTheme)
    if (success) logger.debug(`创建主题样本: ${themeName}`)
    return success
  }

  /**
   * 生成CSS样式
   * @param theme 主题对象
   * @param layoutConfig 布局配置
   */
  generateCssStyles(theme: any, layoutConfig: LayoutConfig): string {
    const backgroundStyles = theme.backgroundImage ?
      `background-image: url('${theme.backgroundImage}'); background-size: cover; background-position: center; background-repeat: no-repeat;` :
      `background: ${theme.colors.background};`

    const overlayStyles = theme.backgroundImage && theme.backgroundOverlay ? `
      .container::before {
        content: ''; position: absolute; top: 0; left: 0; right: 0; bottom: 0;
        background: ${theme.backgroundOverlay}; border-radius: ${theme.borderRadius}; pointer-events: none;
      }` : ''

    const glassEffect = theme.style?.name === '毛玻璃风格' ? `
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
      ${overlayStyles}
      ${glassEffect}

      .header, .footer { border-radius: ${theme.borderRadius}; margin-bottom: ${theme.spacing.itemSpacing}px;
                        display: flex; align-items: center; position: relative; z-index: 1; width: 100%; }

      .header { background: ${theme.colors.surface}; color: ${theme.colors.text}; padding: ${theme.spacing.itemPadding};
               border: ${theme.effects.borderStyle} ${theme.colors.border}; box-shadow: ${theme.effects.shadow};
               background: linear-gradient(135deg, ${theme.colors.surface}, ${theme.colors.background}); }

      .header-logo { height: 28px; margin-right: 12px; border-radius: 6px; }

      .grid-container { display: grid; width: 100%; gap: ${theme.spacing.itemSpacing}px; position: relative; z-index: 1;
                       grid-template-rows: repeat(${layoutConfig.rows}, auto); grid-template-columns: repeat(${layoutConfig.cols}, 1fr); }

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
}
