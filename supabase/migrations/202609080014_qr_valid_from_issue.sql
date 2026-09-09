-- El QR vale desde que se emite. La caseta sigue aplicando el horario de visita.
update public.qr_tokens
set valid_from = created_at
where revoked_at is null
  and valid_from > created_at;

update public.qr_tokens q
set expires_at = greatest(
  q.expires_at,
  v.ends_at + interval '24 hours',
  q.created_at + interval '4 hours'
)
from public.visits v
where v.id = q.visit_id
  and q.revoked_at is null;
