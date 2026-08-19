REVOKE ALL ON FUNCTION public.chat_messages_only_read_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_log_block_mutation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_row_change() FROM PUBLIC, anon, authenticated;