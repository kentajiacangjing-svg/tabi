import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

import { colors } from '@/theme/tokens';

/** 細線で統一したアイコンセット（24px グリッド / stroke 1.5） */
export type IconName =
  | 'home' | 'search' | 'calendar' | 'chat' | 'user' | 'bell' | 'settings' | 'chevron-right' | 'chevron-left'
  | 'chevron-down' | 'close' | 'check' | 'lock' | 'unlock' | 'crown' | 'shield' | 'plus' | 'image' | 'trash' | 'flag'
  | 'block' | 'logout' | 'share' | 'qr' | 'yen' | 'clock' | 'pin' | 'filter' | 'send' | 'info' | 'alert' | 'users'
  | 'chart' | 'doc' | 'sparkle' | 'mail' | 'inbox' | 'card' | 'star' | 'refresh' | 'copy' | 'store' | 'list';

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export function Icon({ name, size = 22, color = colors.text, strokeWidth = 1.5 }: Props) {
  const p = { stroke: color, strokeWidth, fill: 'none', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {render(name, p)}
    </Svg>
  );
}

function render(name: IconName, p: object) {
  switch (name) {
    case 'home':
      return <><Path d="M3.5 10.5 12 4l8.5 6.5" {...p} /><Path d="M5.5 9v10.5h13V9" {...p} /><Path d="M10 19.5v-5h4v5" {...p} /></>;
    case 'search':
      return <><Circle cx="11" cy="11" r="6.5" {...p} /><Line x1="16" y1="16" x2="20.5" y2="20.5" {...p} /></>;
    case 'calendar':
      return <><Rect x="3.5" y="5" width="17" height="15.5" rx="2" {...p} /><Line x1="3.5" y1="9.5" x2="20.5" y2="9.5" {...p} /><Line x1="8" y1="3" x2="8" y2="6.5" {...p} /><Line x1="16" y1="3" x2="16" y2="6.5" {...p} /></>;
    case 'chat':
      return <Path d="M20.5 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.4A8 8 0 1 1 20.5 12Z" {...p} />;
    case 'user':
      return <><Circle cx="12" cy="8.5" r="4" {...p} /><Path d="M4.5 20.5c1.3-3.7 4.2-5.5 7.5-5.5s6.2 1.8 7.5 5.5" {...p} /></>;
    case 'users':
      return <><Circle cx="9" cy="9" r="3.5" {...p} /><Path d="M2.5 19.5c1-3 3.4-4.5 6.5-4.5s5.5 1.5 6.5 4.5" {...p} /><Path d="M15.5 5.6a3.5 3.5 0 0 1 0 6.8M18 15.2c1.7.6 2.9 2 3.5 4.3" {...p} /></>;
    case 'bell':
      return <><Path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15Z" {...p} /><Path d="M10 20.5a2.2 2.2 0 0 0 4 0" {...p} /></>;
    case 'settings':
      return <><Circle cx="12" cy="12" r="3" {...p} /><Path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-2.6-1.5L14 2.6h-4l-.5 2.5A7.6 7.6 0 0 0 6.9 6.6l-2.3-1-2 3.4 2 1.5a7.6 7.6 0 0 0 0 3l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 2.6 1.5l.5 2.5h4l.5-2.5a7.6 7.6 0 0 0 2.6-1.5l2.3 1 2-3.4Z" {...p} /></>;
    case 'chevron-right':
      return <Polyline points="9,5 16,12 9,19" {...p} />;
    case 'chevron-left':
      return <Polyline points="15,5 8,12 15,19" {...p} />;
    case 'chevron-down':
      return <Polyline points="5,9 12,16 19,9" {...p} />;
    case 'close':
      return <><Line x1="6" y1="6" x2="18" y2="18" {...p} /><Line x1="18" y1="6" x2="6" y2="18" {...p} /></>;
    case 'check':
      return <Polyline points="4.5,12.5 9.5,17.5 19.5,6.5" {...p} />;
    case 'lock':
      return <><Rect x="5" y="10.5" width="14" height="10" rx="2" {...p} /><Path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" {...p} /></>;
    case 'unlock':
      return <><Rect x="5" y="10.5" width="14" height="10" rx="2" {...p} /><Path d="M8 10.5V7.5a4 4 0 0 1 7.7-1.5" {...p} /></>;
    case 'crown':
      return <><Path d="M3.5 8 7.5 12 12 5l4.5 7 4-4-1.5 10.5h-14Z" {...p} /></>;
    case 'star':
      return <Path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8Z" {...p} />;
    case 'shield':
      return <><Path d="M12 3 4.5 6v5.5c0 4.6 3.1 8.2 7.5 9.5 4.4-1.3 7.5-4.9 7.5-9.5V6Z" {...p} /><Polyline points="8.5,12 11,14.5 15.5,9.5" {...p} /></>;
    case 'plus':
      return <><Line x1="12" y1="5" x2="12" y2="19" {...p} /><Line x1="5" y1="12" x2="19" y2="12" {...p} /></>;
    case 'image':
      return <><Rect x="3.5" y="4.5" width="17" height="15" rx="2" {...p} /><Circle cx="9" cy="10" r="1.8" {...p} /><Path d="m20.5 16-5-5-8.5 8.5" {...p} /></>;
    case 'trash':
      return <><Path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" {...p} /></>;
    case 'flag':
      return <><Line x1="5.5" y1="21" x2="5.5" y2="4" {...p} /><Path d="M5.5 4.5h11l-2 4 2 4h-11" {...p} /></>;
    case 'block':
      return <><Circle cx="12" cy="12" r="8.5" {...p} /><Line x1="6" y1="6" x2="18" y2="18" {...p} /></>;
    case 'logout':
      return <><Path d="M14 4.5H6v15h8" {...p} /><Line x1="10" y1="12" x2="20.5" y2="12" {...p} /><Polyline points="17,8.5 20.5,12 17,15.5" {...p} /></>;
    case 'share':
      return <><Path d="M12 15V3.5M8 7.5l4-4 4 4" {...p} /><Path d="M5.5 12v8h13v-8" {...p} /></>;
    case 'qr':
      return <><Rect x="4" y="4" width="6" height="6" {...p} /><Rect x="14" y="4" width="6" height="6" {...p} /><Rect x="4" y="14" width="6" height="6" {...p} /><Path d="M14 14h2.5v2.5H14zM18 18h2v2h-2zM14 19.5h2M19.5 14v2" {...p} /></>;
    case 'yen':
      return <><Polyline points="6.5,4 12,11.5 17.5,4" {...p} /><Line x1="12" y1="11.5" x2="12" y2="20" {...p} /><Line x1="7.5" y1="13" x2="16.5" y2="13" {...p} /><Line x1="7.5" y1="16.5" x2="16.5" y2="16.5" {...p} /></>;
    case 'clock':
      return <><Circle cx="12" cy="12" r="8.5" {...p} /><Polyline points="12,7.5 12,12 15,14" {...p} /></>;
    case 'pin':
      return <><Path d="M12 21s6.5-6 6.5-11a6.5 6.5 0 0 0-13 0c0 5 6.5 11 6.5 11Z" {...p} /><Circle cx="12" cy="10" r="2.3" {...p} /></>;
    case 'filter':
      return <><Line x1="4" y1="7" x2="20" y2="7" {...p} /><Line x1="7" y1="12" x2="17" y2="12" {...p} /><Line x1="10" y1="17" x2="14" y2="17" {...p} /></>;
    case 'send':
      return <><Path d="M20.5 3.5 10 14" {...p} /><Path d="M20.5 3.5 14 20.5l-4-6.5-6.5-4Z" {...p} /></>;
    case 'info':
      return <><Circle cx="12" cy="12" r="8.5" {...p} /><Line x1="12" y1="11" x2="12" y2="16.5" {...p} /><Circle cx="12" cy="7.8" r="0.4" {...p} /></>;
    case 'alert':
      return <><Path d="M12 4 2.8 19.5h18.4Z" {...p} /><Line x1="12" y1="10" x2="12" y2="14" {...p} /><Circle cx="12" cy="17" r="0.4" {...p} /></>;
    case 'chart':
      return <><Line x1="4" y1="20" x2="20" y2="20" {...p} /><Rect x="6" y="12" width="3" height="6" {...p} /><Rect x="11" y="8" width="3" height="10" {...p} /><Rect x="16" y="4" width="3" height="14" {...p} /></>;
    case 'doc':
      return <><Path d="M6 3.5h8l4 4v13H6Z" {...p} /><Path d="M14 3.5v4h4M9 12h6M9 15.5h6" {...p} /></>;
    case 'sparkle':
      return <Path d="M12 3.5c.6 4.2 2.9 6.5 7 7-4.1.6-6.4 2.9-7 7.1-.6-4.2-2.9-6.5-7-7.1 4.1-.5 6.4-2.8 7-7Z" {...p} />;
    case 'mail':
      return <><Rect x="3.5" y="5.5" width="17" height="13" rx="2" {...p} /><Polyline points="4,7 12,13 20,7" {...p} /></>;
    case 'inbox':
      return <><Path d="M3.5 13.5 6 5.5h12l2.5 8V19h-17Z" {...p} /><Path d="M3.5 13.5H9l1 2h4l1-2h5.5" {...p} /></>;
    case 'card':
      return <><Rect x="3" y="5.5" width="18" height="13" rx="2" {...p} /><Line x1="3" y1="10" x2="21" y2="10" {...p} /><Line x1="6.5" y1="15" x2="10" y2="15" {...p} /></>;
    case 'refresh':
      return <><Path d="M19.5 8A8 8 0 0 0 5 9M4.5 16A8 8 0 0 0 19 15" {...p} /><Polyline points="19.5,3.5 19.5,8 15,8" {...p} /><Polyline points="4.5,20.5 4.5,16 9,16" {...p} /></>;
    case 'copy':
      return <><Rect x="8.5" y="8.5" width="11" height="12" rx="1.5" {...p} /><Path d="M15.5 8.5V4.5h-11v12h4" {...p} /></>;
    case 'store':
      return <><Path d="M4 9.5 5.5 4.5h13L20 9.5" {...p} /><Path d="M4 9.5c0 1.4 1.1 2.5 2.7 2.5S9.3 10.9 9.3 9.5c0 1.4 1.2 2.5 2.7 2.5s2.7-1.1 2.7-2.5c0 1.4 1.1 2.5 2.6 2.5S20 10.9 20 9.5" {...p} /><Path d="M5.5 12v8h13v-8M10 20v-4.5h4V20" {...p} /></>;
    case 'list':
      return <><Line x1="8.5" y1="7" x2="20" y2="7" {...p} /><Line x1="8.5" y1="12" x2="20" y2="12" {...p} /><Line x1="8.5" y1="17" x2="20" y2="17" {...p} /><Circle cx="4.8" cy="7" r="0.6" {...p} /><Circle cx="4.8" cy="12" r="0.6" {...p} /><Circle cx="4.8" cy="17" r="0.6" {...p} /></>;
  }
}
