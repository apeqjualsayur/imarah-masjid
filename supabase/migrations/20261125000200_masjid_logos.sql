-- Step 4: masjid logos in private Storage.
-- Files live at masjids/<masjid_id>/<file>. Members read their own masjid's
-- folder; only the Pengerusi writes. Logos are shown through short-lived
-- signed links made on the server, never public URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('masjid-logos', 'masjid-logos', false, 1048576, array['image/png', 'image/svg+xml'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- True when an object path sits in the caller's own masjid folder.
create function private.in_own_logo_folder(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (storage.foldername(object_name))[1] = 'masjids'
    and (storage.foldername(object_name))[2] = private.current_masjid_id()::text
    and array_length(storage.foldername(object_name), 1) = 2;
$$;

revoke all on function private.in_own_logo_folder(text) from public, anon;
grant execute on function private.in_own_logo_folder(text) to authenticated;

create policy masjid_logos_read on storage.objects for select to authenticated
  using (bucket_id = 'masjid-logos' and private.in_own_logo_folder(name));

create policy masjid_logos_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'masjid-logos'
    and private.in_own_logo_folder(name)
    and (select private.has_role('pengerusi')));

create policy masjid_logos_update on storage.objects for update to authenticated
  using (bucket_id = 'masjid-logos'
    and private.in_own_logo_folder(name)
    and (select private.has_role('pengerusi')))
  with check (bucket_id = 'masjid-logos'
    and private.in_own_logo_folder(name)
    and (select private.has_role('pengerusi')));

create policy masjid_logos_delete on storage.objects for delete to authenticated
  using (bucket_id = 'masjid-logos'
    and private.in_own_logo_folder(name)
    and (select private.has_role('pengerusi')));

-- A masjid's logo must be a file in its own folder, so a logo can never point
-- at another masjid's file.
alter table public.masjids add constraint masjids_logo_in_own_folder
  check (logo_path is null or logo_path like 'masjids/' || id::text || '/%');
