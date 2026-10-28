import { Image } from 'expo-image';
import { router } from 'expo-router';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, StyleSheet,
  Text, TextInput, View, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { Icon, type IconName } from '@/components/Icon';
import { useSignedUrls } from '@/lib/photos';
import { colors, fonts, hitSlop, maxWidth, radius, shadow, space } from '@/theme/tokens';

// ------------------------------------------------------------------ typography
type TVariant = 'display' | 'title' | 'h2' | 'h3' | 'body' | 'sub' | 'small' | 'caption' | 'num' | 'brand';
export function T({ v = 'body', style, children, numberOfLines, color, center, selectable }: {
  v?: TVariant; style?: StyleProp<TextStyle>; children: ReactNode; numberOfLines?: number; color?: string; center?: boolean; selectable?: boolean;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[styles.tBase, tStyles[v], color ? { color } : null, center ? { textAlign: 'center' } : null, style]}>
      {children}
    </Text>
  );
}

const tStyles = StyleSheet.create({
  brand: { fontFamily: fonts.serifBold, fontSize: 30, letterSpacing: 6, color: colors.text },
  display: { fontSize: 28, lineHeight: 38, fontWeight: '600', letterSpacing: 0.4 },
  title: { fontSize: 22, lineHeight: 31, fontWeight: '600', letterSpacing: 0.3 },
  h2: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  h3: { fontSize: 15.5, lineHeight: 23, fontWeight: '600' },
  body: { fontSize: 15, lineHeight: 24 },
  sub: { fontSize: 13.5, lineHeight: 21, color: colors.sub },
  small: { fontSize: 12, lineHeight: 18, color: colors.sub },
  caption: { fontSize: 11, lineHeight: 16, letterSpacing: 2.2, color: colors.goldDeep, fontWeight: '600' },
  num: { fontFamily: fonts.serif, fontSize: 30, lineHeight: 36, color: colors.text, letterSpacing: 0.5 },
});

// ------------------------------------------------------------------ layout
export function Screen({ children, scroll = true, refreshing, onRefresh, padded = true, footer, style, wide }: {
  children: ReactNode; scroll?: boolean; refreshing?: boolean; onRefresh?: () => void; padded?: boolean; footer?: ReactNode;
  style?: StyleProp<ViewStyle>; wide?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const inner = (
    <View style={[styles.inner, { maxWidth: wide ? 1120 : maxWidth }, padded && { paddingHorizontal: space.lg }, style]}>{children}</View>
  );
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={{ paddingBottom: space.xxxl + (footer ? 0 : insets.bottom) }}
          keyboardShouldPersistTaps="handled"
          refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.gold} /> : undefined}>
          {inner}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
          <View style={[styles.inner, { maxWidth, paddingHorizontal: space.lg }]}>{footer}</View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

export function Header({ title, back = true, right, subtitle, large }: { title?: string; back?: boolean; right?: ReactNode; subtitle?: string; large?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + (Platform.OS === 'web' ? space.md : space.xs) }]}>
      <View style={[styles.headerRow, { maxWidth }]}>
        <View style={styles.headerSide}>
          {back ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="戻る"
              hitSlop={hitSlop}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
              style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
              <Icon name="chevron-left" size={24} />
            </Pressable>
          ) : null}
        </View>
        {!large ? (
          <View style={styles.headerTitle}>
            <T v="h3" numberOfLines={1} center>{title}</T>
            {subtitle ? <T v="small" numberOfLines={1} center>{subtitle}</T> : null}
          </View>
        ) : <View style={{ flex: 1 }} />}
        <View style={[styles.headerSide, { alignItems: 'flex-end' }]}>{right}</View>
      </View>
      {large && title ? (
        <View style={[styles.headerRow, { maxWidth, paddingTop: space.xs }]}>
          <View style={{ flex: 1 }}>
            <T v="title">{title}</T>
            {subtitle ? <T v="sub">{subtitle}</T> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function IconButton({ name, onPress, label, badge }: { name: IconName; onPress: () => void; label: string; badge?: number }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} hitSlop={hitSlop} onPress={onPress} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
      <Icon name={name} size={22} />
      {badge ? (
        <View style={styles.dot}>
          <Text style={styles.dotText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

export function Gap({ h = space.lg }: { h?: number }) {
  return <View style={{ height: h }} />;
}

export function Row({ children, gap = space.sm, style, wrap }: { children: ReactNode; gap?: number; style?: StyleProp<ViewStyle>; wrap?: boolean }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, wrap && { flexWrap: 'wrap' }, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

/** title は「ENGLISH ・ 日本語」の形式なら英字キャプション＋日本語見出しの2段で表示 */
export function Section({ title, action, children, style }: { title: string; action?: ReactNode; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [en, ja] = title.includes(' ・ ') ? title.split(' ・ ') : [title, ''];
  return (
    <View style={[{ marginTop: space.xl }, style]}>
      <Row style={{ justifyContent: 'space-between', marginBottom: space.md, alignItems: 'flex-end' }}>
        <View style={{ flexShrink: 1 }}>
          <T v="caption">{en}</T>
          {ja ? <T v="h3" style={{ marginTop: 2 }}>{ja}</T> : null}
        </View>
        {action}
      </Row>
      {children}
    </View>
  );
}

export function Card({ children, style, onPress, padded = true, accessibilityLabel }: { children: ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; padded?: boolean; accessibilityLabel?: string }) {
  const body = <View style={[styles.card, padded && { padding: space.lg }, style]}>{children}</View>;
  if (!onPress) return body;
  // flex 系の指定は外側の Pressable にも渡して、横並び時に幅を揃える
  const flat = StyleSheet.flatten(style) ?? {};
  const outer = { flex: flat.flex, flexGrow: flat.flexGrow, flexBasis: flat.flexBasis, width: flat.width, minWidth: flat.minWidth };
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [outer, pressed && styles.pressedCard]}>
      {body}
    </Pressable>
  );
}

// ------------------------------------------------------------------ buttons
type BtnVariant = 'primary' | 'gold' | 'outline' | 'ghost' | 'danger' | 'quiet';
export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, small, style, testID }: {
  title: string; onPress?: () => void | Promise<void>; variant?: BtnVariant; loading?: boolean; disabled?: boolean; icon?: IconName;
  small?: boolean; style?: StyleProp<ViewStyle>; testID?: string;
}) {
  const [busy, setBusy] = useState(false);
  const isLoading = loading || busy;
  const fg = variant === 'primary' || variant === 'gold' || variant === 'danger' ? '#FFFFFF' : variant === 'outline' ? colors.goldDeep : variant === 'quiet' ? colors.sub : colors.text;
  const handle = async () => {
    if (!onPress || isLoading || disabled) return;
    const r = onPress();
    if (r instanceof Promise) {
      setBusy(true);
      try {
        await r;
      } finally {
        setBusy(false);
      }
    }
  };
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled, busy: isLoading }}
      accessibilityLabel={title}
      onPress={handle}
      disabled={disabled || isLoading}
      style={({ pressed }) => [
        styles.btn, small && styles.btnSmall, btnStyles[variant], (disabled) && styles.btnDisabled, pressed && styles.pressed, style,
      ]}>
      {variant === 'gold' ? <GoldFill /> : null}
      {isLoading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Row gap={space.sm}>
          {icon ? <Icon name={icon} size={18} color={fg} /> : null}
          <Text style={[styles.btnText, small && { fontSize: 13.5 }, { color: fg }]}>{title}</Text>
        </Row>
      )}
    </Pressable>
  );
}

function GoldFill() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={colors.goldLight} />
            <Stop offset="0.55" stopColor={colors.gold} />
            <Stop offset="1" stopColor={colors.goldDeep} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g)" />
      </Svg>
    </View>
  );
}

const btnStyles = StyleSheet.create({
  primary: { backgroundColor: colors.text },
  gold: { backgroundColor: colors.gold, overflow: 'hidden' },
  outline: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.gold },
  ghost: { backgroundColor: 'transparent' },
  quiet: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border },
  danger: { backgroundColor: colors.danger },
});

// ------------------------------------------------------------------ status / rank
export function RankBadge({ code, size = 'md', locked }: { code: string; size?: 'sm' | 'md' | 'lg'; locked?: boolean }) {
  const d = size === 'sm' ? 26 : size === 'lg' ? 56 : 36;
  return (
    <View
      accessibilityLabel={`${code}ランク${locked ? '（ロック中）' : ''}`}
      style={[styles.rank, { width: d, height: d, borderRadius: d / 2 }, locked && { borderColor: colors.borderStrong }]}>
      <Text style={{ fontFamily: fonts.serifBold, fontSize: d * 0.5, color: locked ? colors.faint : colors.goldDeep, lineHeight: d * 0.62 }}>{code}</Text>
    </View>
  );
}

export function Pill({ label, tone = 'neutral', icon }: { label: string; tone?: 'neutral' | 'gold' | 'success' | 'danger' | 'dark'; icon?: IconName }) {
  const t = {
    neutral: { bg: colors.bg, fg: colors.sub, bd: colors.border },
    gold: { bg: colors.goldWash, fg: colors.goldDeep, bd: '#E9DDC4' },
    success: { bg: colors.successWash, fg: colors.success, bd: '#D3E6DB' },
    danger: { bg: colors.dangerWash, fg: colors.danger, bd: '#F2D2CF' },
    dark: { bg: colors.text, fg: '#FFFFFF', bd: colors.text },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg, borderColor: t.bd }]}>
      {icon ? <Icon name={icon} size={12} color={t.fg} strokeWidth={1.8} /> : null}
      <Text style={[styles.pillText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, 'neutral' | 'gold' | 'success' | 'danger' | 'dark']> = {
    requested: ['承認待ち', 'gold'], accepted: ['予約確定', 'dark'], declined: ['不成立', 'neutral'], canceled: ['キャンセル', 'neutral'],
    completed: ['完了', 'success'], disputed: ['申立て中', 'danger'],
  };
  const [label, tone] = map[status] ?? [status, 'neutral'];
  return <Pill label={label} tone={tone} />;
}

/** 控えめな金色の進捗バー */
export function Meter({ value, max, label, left, right }: { value: number; max: number; label?: string; left?: string; right?: string }) {
  const pct = max <= 0 ? 1 : Math.max(0, Math.min(1, value / max));
  return (
    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
      {label ? <T v="small" style={{ marginBottom: 6 }}>{label}</T> : null}
      <View style={styles.meterTrack}>
        <View style={[styles.meterFill, { width: `${pct * 100}%` }]}>
          <Svg width="100%" height="100%">
            <Defs>
              <LinearGradient id="m" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={colors.goldLight} />
                <Stop offset="1" stopColor={colors.gold} />
              </LinearGradient>
            </Defs>
            <Rect x="0" y="0" width="100%" height="100%" fill="url(#m)" />
          </Svg>
        </View>
      </View>
      {left || right ? (
        <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <T v="small">{left}</T>
          <T v="small">{right}</T>
        </Row>
      ) : null}
    </View>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={{ flex: 1, minWidth: 120 }}>
      <T v="small">{label}</T>
      <T v="num" style={{ fontSize: 26 }}>{value}</T>
      {note ? <T v="small">{note}</T> : null}
    </View>
  );
}

export function Notice({ tone = 'gold', icon = 'info', title, children, action }: { tone?: 'gold' | 'danger' | 'neutral' | 'success'; icon?: IconName; title?: string; children?: ReactNode; action?: ReactNode }) {
  const t = { gold: [colors.goldWash, colors.goldDeep], danger: [colors.dangerWash, colors.danger], neutral: [colors.bg, colors.sub], success: [colors.successWash, colors.success] }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: t[0] }]}>
      <Icon name={icon} size={18} color={t[1]} />
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <T v="h3" color={t[1]} style={{ fontSize: 14 }}>{title}</T> : null}
        {isTextLike(children) ? <T v="sub" color={tone === 'neutral' ? colors.sub : colors.text}>{children}</T> : children}
        {action ? <View style={{ marginTop: space.sm, alignSelf: 'flex-start' }}>{action}</View> : null}
      </View>
    </View>
  );
}

function isTextLike(c: ReactNode): boolean {
  return typeof c === 'string' || typeof c === 'number' || (Array.isArray(c) && c.every((x) => typeof x === 'string' || typeof x === 'number'));
}

export function DemoTag({ label = 'デモ表示' }: { label?: string }) {
  return <Pill label={label} tone="gold" icon="info" />;
}

// ------------------------------------------------------------------ list rows
export function ListRow({ icon, title, subtitle, onPress, right, danger, testID }: { icon?: IconName; title: string; subtitle?: string; onPress?: () => void; right?: ReactNode; danger?: boolean; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole={onPress ? 'button' : undefined} accessibilityLabel={title} onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.bg }]}>
      {icon ? (
        <View style={styles.listIcon}>
          <Icon name={icon} size={19} color={danger ? colors.danger : colors.goldDeep} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T v="body" color={danger ? colors.danger : undefined}>{title}</T>
        {subtitle ? <T v="small">{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Icon name="chevron-right" size={18} color={colors.faint} /> : null)}
    </Pressable>
  );
}

export function ListGroup({ children }: { children: ReactNode }) {
  return <View style={[styles.card, { paddingVertical: space.xs }]}>{children}</View>;
}

// ------------------------------------------------------------------ inputs
export function Field({ label, error, hint, style, ...props }: TextInputProps & { label: string; error?: string | null; hint?: string }) {
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: space.lg }, style as StyleProp<ViewStyle>]}>
      <T v="small" style={{ marginBottom: 6, color: colors.text, fontWeight: '600' }}>{label}</T>
      <TextInput
        placeholderTextColor={colors.faint}
        accessibilityLabel={label}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        style={[styles.input, props.multiline && { minHeight: 110, textAlignVertical: 'top', paddingTop: 12 }, focus && { borderColor: colors.gold }, error ? { borderColor: colors.danger } : null]}
      />
      {error ? <T v="small" color={colors.danger} style={{ marginTop: 4 }}>{error}</T> : hint ? <T v="small" style={{ marginTop: 4 }}>{hint}</T> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress: () => void; icon?: IconName }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}>
      {icon ? <Icon name={icon} size={14} color={selected ? colors.goldDeep : colors.sub} /> : null}
      <Text style={[styles.chipText, selected && { color: colors.goldDeep, fontWeight: '600' }]}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<V extends string>({ value, options, onChange }: { value: V; options: { value: V; label: string }[]; onChange: (v: V) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable
          key={o.value}
          accessibilityRole="tab"
          accessibilityState={{ selected: o.value === value }}
          onPress={() => onChange(o.value)}
          style={[styles.segItem, o.value === value && styles.segOn]}>
          <Text style={[styles.segText, o.value === value && { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Toggle({ value, onChange, label, description }: { value: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <T v="body">{label}</T>
        {description ? <T v="small">{description}</T> : null}
      </View>
      <View style={[styles.switch, value && { backgroundColor: colors.gold, borderColor: colors.gold }]}>
        <View style={[styles.knob, value && { transform: [{ translateX: 18 }] }]} />
      </View>
    </Pressable>
  );
}

export function Check({ checked, onChange, children, testID }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; testID?: string }) {
  return (
    <Pressable testID={testID} accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onChange(!checked)} style={styles.check}>
      <View style={[styles.box, checked && { backgroundColor: colors.text, borderColor: colors.text }]}>
        {checked ? <Icon name="check" size={14} color="#fff" strokeWidth={2} /> : null}
      </View>
      <View style={{ flex: 1 }}>{children}</View>
    </Pressable>
  );
}


// ------------------------------------------------------------------ media
export function Photo({ path, style, rounded = radius.lg, placeholder = 'image', contentFit = 'cover' }: { path?: string | null; style?: StyleProp<ViewStyle>; rounded?: number; placeholder?: IconName; contentFit?: 'cover' | 'contain' }) {
  const urls = useSignedUrls([path]);
  const uri = path ? urls[path] : undefined;
  return (
    <View style={[{ backgroundColor: colors.goldWash, borderRadius: rounded, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }, style]}>
      {uri ? (
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit={contentFit} transition={250} accessibilityIgnoresInvertColors />
      ) : (
        <Icon name={placeholder} size={28} color={colors.goldLight} />
      )}
    </View>
  );
}

export function Avatar({ path, size = 44 }: { path?: string | null; size?: number }) {
  return <Photo path={path} rounded={size / 2} placeholder="user" style={{ width: size, height: size }} />;
}

// ------------------------------------------------------------------ states
export function Skeleton({ h = 16, w = '100%', r = radius.sm, style }: { h?: number; w?: number | `${number}%`; r?: number; style?: StyleProp<ViewStyle> }) {
  const [op] = useState(() => new Animated.Value(0.5));
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([
      Animated.timing(op, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(op, { toValue: 0.5, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
    ]));
    a.start();
    return () => a.stop();
  }, [op]);
  return <Animated.View style={[{ height: h, width: w, borderRadius: r, backgroundColor: '#EFEBE3', opacity: op }, style]} />;
}

export function LoadingList({ count = 3, h = 96 }: { count?: number; h?: number }) {
  return (
    <View style={{ gap: space.md, marginTop: space.lg }} accessibilityLabel="読み込み中">
      {Array.from({ length: count }, (_, i) => <Skeleton key={i} h={h} r={radius.lg} />)}
    </View>
  );
}

export function Empty({ icon = 'sparkle', title, text, action }: { icon?: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}><Icon name={icon} size={26} color={colors.gold} /></View>
      <T v="h3" center>{title}</T>
      {text ? <T v="sub" center style={{ maxWidth: 320 }}>{text}</T> : null}
      {action ? <View style={{ marginTop: space.md }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return <Empty icon="alert" title="読み込めませんでした" text={message} action={onRetry ? <Button title="再読み込み" variant="outline" small onPress={onRetry} /> : null} />;
}

// ------------------------------------------------------------------ toast
type ToastKind = 'success' | 'error' | 'info';
const ToastCtx = createContext<(msg: string, kind?: ToastKind) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<{ msg: string; kind: ToastKind; id: number } | null>(null);
  const [anim] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const show = useCallback((msg: string, kind: ToastKind = 'success') => {
    setToast({ msg, kind, id: Date.now() });
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(anim, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setToast(null));
    }, kind === 'error' ? 4200 : 2600);
  }, [anim]);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          accessibilityLiveRegion="polite"
          style={[styles.toastWrap, { top: insets.top + space.sm, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
          <Pressable onPress={() => setToast(null)} style={[styles.toast, toast.kind === 'error' && { borderColor: '#F2D2CF' }]} accessibilityRole="alert">
            <Icon name={toast.kind === 'error' ? 'alert' : toast.kind === 'info' ? 'info' : 'check'} size={18} color={toast.kind === 'error' ? colors.danger : colors.goldDeep} />
            <Text style={styles.toastText}>{toast.msg}</Text>
          </Pressable>
        </Animated.View>
      ) : null}
    </ToastCtx.Provider>
  );
}

// ------------------------------------------------------------------ sheet / confirm
export function Sheet({ visible, onClose, title, children }: { visible: boolean; onClose: () => void; title?: string; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="閉じる" />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, space.lg) }]}>
          <View style={styles.grabber} />
          <Row style={{ justifyContent: 'space-between', marginBottom: space.md }}>
            <T v="h2" style={{ flex: 1 }}>{title}</T>
            <IconButton name="close" label="閉じる" onPress={onClose} />
          </Row>
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 560 }}>{children}</ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

type ConfirmOpts = { title: string; message?: string; confirm?: string; danger?: boolean; input?: { label: string; placeholder?: string; required?: boolean } };
const ConfirmCtx = createContext<(o: ConfirmOpts) => Promise<{ ok: boolean; text: string }>>(async () => ({ ok: false, text: '' }));
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null);
  const [text, setText] = useState('');
  const resolver = useRef<((v: { ok: boolean; text: string }) => void) | null>(null);
  const ask = useCallback((o: ConfirmOpts) => {
    setText('');
    setOpts(o);
    return new Promise<{ ok: boolean; text: string }>((res) => { resolver.current = res; });
  }, []);
  const close = (ok: boolean) => {
    resolver.current?.({ ok, text });
    resolver.current = null;
    setOpts(null);
  };
  return (
    <ConfirmCtx.Provider value={ask}>
      {children}
      <Sheet visible={!!opts} onClose={() => close(false)} title={opts?.title}>
        {opts?.message ? <T v="sub" style={{ marginBottom: space.lg }}>{opts.message}</T> : null}
        {opts?.input ? <Field label={opts.input.label} placeholder={opts.input.placeholder} value={text} onChangeText={setText} multiline /> : null}
        <View style={{ gap: space.sm }}>
          <Button title={opts?.confirm ?? 'OK'} variant={opts?.danger ? 'danger' : 'primary'} disabled={!!opts?.input?.required && !text.trim()} onPress={() => close(true)} testID="confirm-ok" />
          <Button title="やめる" variant="ghost" onPress={() => close(false)} />
        </View>
      </Sheet>
    </ConfirmCtx.Provider>
  );
}

// ------------------------------------------------------------------ styles
const styles = StyleSheet.create({
  tBase: { color: colors.text, fontFamily: fonts.sans },
  screen: { flex: 1, backgroundColor: colors.bg },
  inner: { width: '100%', alignSelf: 'center' },
  footer: { backgroundColor: 'rgba(250,249,246,0.97)', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: space.md },
  header: { backgroundColor: colors.bg, paddingHorizontal: space.sm, paddingBottom: space.sm },
  headerRow: { flexDirection: 'row', alignItems: 'center', width: '100%', alignSelf: 'center', minHeight: 44, paddingHorizontal: space.sm },
  headerSide: { width: 72, flexDirection: 'row', alignItems: 'center' },
  headerTitle: { flex: 1, alignItems: 'center' },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22 },
  pressed: { opacity: 0.65 },
  pressedCard: { opacity: 0.9, transform: [{ scale: 0.995 }] },
  dot: { position: 'absolute', top: 6, right: 4, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  dotText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, ...shadow },
  btn: { minHeight: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl, overflow: 'hidden' },
  btnSmall: { minHeight: 40, paddingHorizontal: space.lg },
  btnDisabled: { opacity: 0.4 },
  btnText: { fontSize: 15.5, fontWeight: '600', letterSpacing: 0.6, fontFamily: fonts.sans },
  rank: { borderWidth: 1, borderColor: colors.gold, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  pillText: { fontSize: 11.5, fontWeight: '600', letterSpacing: 0.3, fontFamily: fonts.sans },
  meterTrack: { height: 6, borderRadius: 3, backgroundColor: '#EFEAE0', overflow: 'hidden' },
  meterFill: { height: 6, borderRadius: 3, overflow: 'hidden' },
  notice: { flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.md, alignItems: 'flex-start' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, minHeight: 56, paddingVertical: space.sm },
  listIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.goldWash, alignItems: 'center', justifyContent: 'center' },
  input: { minHeight: 50, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: 14, fontSize: 16, color: colors.text, fontFamily: fonts.sans },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, minHeight: 38, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  chipOn: { borderColor: colors.gold, backgroundColor: colors.goldWash },
  chipText: { fontSize: 13.5, color: colors.sub, fontFamily: fonts.sans },
  seg: { flexDirection: 'row', backgroundColor: '#F1EEE7', borderRadius: radius.pill, padding: 3 },
  segItem: { flex: 1, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  segOn: { backgroundColor: colors.surface, ...shadow },
  segText: { fontSize: 13.5, color: colors.sub, fontFamily: fonts.sans },
  check: { flexDirection: 'row', gap: space.md, alignItems: 'center', paddingVertical: space.sm, minHeight: 44 },
  box: { width: 22, height: 22, borderRadius: radius.sm - 2, borderWidth: 1.2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.md, minHeight: 56 },
  switch: { width: 46, height: 28, borderRadius: 14, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: '#EFEBE3', padding: 2, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', ...shadow },
  empty: { alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl, paddingHorizontal: space.lg },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.goldLight, alignItems: 'center', justifyContent: 'center', marginBottom: space.sm },
  toastWrap: { position: 'absolute', left: space.lg, right: space.lg, alignItems: 'center', zIndex: 1000 },
  toast: { flexDirection: 'row', alignItems: 'center', gap: space.sm, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: space.md, borderWidth: 1, borderColor: '#E9DDC4', maxWidth: 520, ...shadow },
  toastText: { fontSize: 14, color: colors.text, flexShrink: 1, fontFamily: fonts.sans },
  sheetBackdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, backgroundColor: colors.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space.xl, paddingTop: space.sm },
  grabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: colors.border, marginBottom: space.md },
});
