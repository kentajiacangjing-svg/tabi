import { RoleTabs } from '@/components/TabBar';

export default function WomanTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'ホーム', icon: 'home' },
        { name: 'requests', title: '申込', icon: 'inbox' },
        { name: 'schedule', title: '日程', icon: 'calendar' },
        { name: 'messages', title: 'メッセージ', icon: 'chat' },
        { name: 'me', title: 'マイページ', icon: 'user' },
      ]}
    />
  );
}
