import * as Clipboard from 'expo-clipboard';
import QRCode from 'qrcode';
import { useMemo } from 'react';
import { Share, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { Button, Card, ErrorState, Header, LoadingList, Notice, Row, Screen, Section, T, useConfirm, useToast } from '@/components/ui';
import { call, toMessage, useRpc } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { inviteUrl } from '@/lib/nav';
import { colors, space } from '@/theme/tokens';

type Link = { code: string; uses: number; created_at: string };

export default function ShareScreen() {
  const { me } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();
  const res = useRpc<Link>('get_share_link', { p_regenerate: false });
  const url = res.data ? inviteUrl(res.data.code) : '';

  const regenerate = async () => {
    const r = await confirm({ title: 'リンクを再発行しますか？', message: '現在のリンク・QRは使えなくなります。すでに参加済みのお客様には影響しません。', confirm: '再発行する' });
    if (!r.ok) return;
    try {
      res.setData(await call<Link>('get_share_link', { p_regenerate: true }));
      toast('新しいリンクを発行しました');
    } catch (e) {
      toast(toMessage(e), 'error');
    }
  };

  return (
    <>
      <Header title="紹介用リンク・QR" />
      <Screen>
        <T v="sub" style={{ marginTop: space.sm }}>
          いつも来てくださるお客様を、あなたのプロフィールへ招待できます。リンクから参加した方は、ランク条件にかかわらずあなたへ申し込みでき、予約はあなたの承認で成立します。
        </T>
        {res.loading ? <LoadingList count={1} h={320} /> : res.error || !res.data ? <ErrorState message={res.error ?? ''} onRetry={res.reload} /> : (
          <>
            <Card style={{ marginTop: space.lg, alignItems: 'center' }}>
              <T v="caption">INVITATION</T>
              <T v="h2" style={{ marginTop: 4 }}>{me?.display_name}さんのプロフィール</T>
              <View style={{ marginVertical: space.lg, padding: space.md, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: colors.border }}>
                <Qr value={url} size={200} />
              </View>
              <T v="small" selectable center numberOfLines={2}>{url}</T>
              <T v="small" style={{ marginTop: space.sm }}>参加数 {res.data.uses}</T>
            </Card>
            <Row gap={space.sm} style={{ marginTop: space.lg }}>
              <Button style={{ flex: 1 }} variant="outline" icon="copy" title="コピー" onPress={async () => { await Clipboard.setStringAsync(url); toast('リンクをコピーしました'); }} testID="share-copy" />
              <Button style={{ flex: 1 }} icon="share" title="共有" onPress={async () => { await Share.share({ message: `プロフィールはこちらです\n${url}` }).catch(() => {}); }} />
            </Row>
            <Button variant="ghost" title="リンクを再発行する" onPress={regenerate} style={{ marginTop: space.sm }} />
            <Section title="PRIVACY">
              <Notice tone="neutral" icon="shield">
                共有するかどうかはあなたが決めます。参加したお客様の情報（連絡先・利用額など）が第三者や他の女性会員に開示されることはありません。リンクが広まった場合は再発行してください。
              </Notice>
            </Section>
          </>
        )}
      </Screen>
    </>
  );
}

function Qr({ value, size }: { value: string; size: number }) {
  const matrix = useMemo(() => {
    const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
    return { n: qr.modules.size, data: qr.modules.data };
  }, [value]);
  const cell = size / matrix.n;
  const rects = [];
  for (let y = 0; y < matrix.n; y++) {
    for (let x = 0; x < matrix.n; x++) {
      if (matrix.data[y * matrix.n + x]) rects.push(<Rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell + 0.3} height={cell + 0.3} fill={colors.text} />);
    }
  }
  return (
    <Svg width={size} height={size} accessibilityLabel="招待用QRコード">
      {rects}
    </Svg>
  );
}
