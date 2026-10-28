import { Platform } from 'react-native';

/** 白×ゴールドのデザイントークン。金色は文字・細線・ステータスに限定して使う。 */
export const colors = {
  bg: '#FAF9F6',
  surface: '#FFFFFF',
  text: '#171717',
  sub: '#737373',
  faint: '#A3A3A3',
  gold: '#B89B5E',
  goldLight: '#D7BE88',
  goldDeep: '#8A6A35',
  border: '#EDE9E1',
  borderStrong: '#DCD5C8',
  goldWash: '#F6F1E7',
  danger: '#B3261E',
  dangerWash: '#FBEDEC',
  success: '#2F6B4F',
  successWash: '#EAF3EE',
  overlay: 'rgba(23,23,23,0.42)',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 18, xl: 24, pill: 999 } as const;

export const fonts = {
  /** 欧文の見出し・数字（ブランドの静かな高級感） */
  serif: 'CormorantGaramond_500Medium',
  serifBold: 'CormorantGaramond_600SemiBold',
  /** 日本語本文は各OSのシステムフォント（可読性優先） */
  sans: Platform.select({
    web: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", system-ui, -apple-system, "Segoe UI", sans-serif',
    default: undefined,
  }),
};

export const shadow = Platform.select({
  web: { boxShadow: '0 1px 2px rgba(23,23,23,0.04), 0 8px 24px rgba(23,23,23,0.05)' } as object,
  default: {
    shadowColor: '#171717',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});

/** タブレット・PC でも読みやすい最大幅 */
export const maxWidth = 720;
export const hitSlop = { top: 8, bottom: 8, left: 8, right: 8 };
