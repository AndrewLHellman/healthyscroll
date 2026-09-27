-- Allow skips decided on the last-resort audio pass (text + frames + the Reel's
-- transcript from ElevenLabs) to be logged with stage 'audio'.
-- Apply in Supabase → SQL Editor. Undo: the same with 'audio' removed from the list.

alter table public.skips drop constraint skips_stage_check;
alter table public.skips
  add constraint skips_stage_check check (stage in ('text', 'visual', 'monitor', 'audio'));
