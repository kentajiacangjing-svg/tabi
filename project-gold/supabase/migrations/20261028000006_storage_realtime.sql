-- プロフィール写真: 非公開バケット + 署名付きURL。アップロードは自分のフォルダ（{uid}/...）のみ。
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/svg+xml'])
on conflict (id) do nothing;

create policy photos_upload_own on storage.objects for insert to authenticated
  with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = auth.uid()::text);
-- 閲覧（署名URLの発行）: 本人 / 公開承認済みの写真 / 管理者
-- profile_photos 自体も RLS 下にあるため、判定は security definer 関数で行う
create or replace function public.photo_is_viewable(p_path text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profile_photos p join public.profiles u on u.id = p.user_id
                 where p.storage_path = p_path and p.status = 'approved' and u.status = 'active'
                   and not public.is_blocked_pair(p.user_id, auth.uid()))
$$;
revoke execute on function public.photo_is_viewable(text) from public, anon;
grant execute on function public.photo_is_viewable(text) to authenticated;

create policy photos_read on storage.objects for select to authenticated
  using (bucket_id = 'profile-photos' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or public.photo_is_viewable(name)));

-- Realtime: メッセージと通知の変更を購読（配信対象は上記 RLS の select ポリシーで制限される）
alter publication supabase_realtime add table public.messages, public.notifications;
