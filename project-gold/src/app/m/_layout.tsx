import { RoleTabs } from '@/components/TabBar';

export default function ManTabs() {
  return (
    <RoleTabs
      tabs={[
        { name: 'index', title: 'ホーム', icon: 'home' },
        { name: 'search', title: 'さがす', icon: 'search' },
        { name: 'bookings', title: '予約', icon: 'calendar' },
        { name: 'messages', title: 'メッセージ', icon: 'chat' },
        { name: 'me', title: 'マイページ', icon: 'user' },
      ]}
    />
  );
}
