-- Datos exclusivamente demostrativos. Contraseña común: NexaDemo2026!
insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated','admin@novalogistics.demo',crypt('NexaDemo2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated','mateo@novalogistics.demo',crypt('NexaDemo2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated','valeria@novalogistics.demo',crypt('NexaDemo2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated','guardia1@novalogistics.demo',crypt('NexaDemo2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now()),
('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated','guardia2@novalogistics.demo',crypt('NexaDemo2026!',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{}',now(),now());
-- Auth lee estas columnas como texto, no como nulos. Si quedan en NULL, el
-- inicio de sesión falla con «Database error querying schema» aunque la
-- contraseña sea correcta (verificado contra un proyecto real). Al registrarse
-- por la aplicación las escribe Auth; al insertar usuarios a mano, hay que
-- ponerlas en cadena vacía.
update auth.users set
  confirmation_token = '', recovery_token = '', email_change = '',
  email_change_token_new = '', email_change_token_current = '',
  phone_change = '', phone_change_token = '', reauthentication_token = ''
where id::text like '10000000-%';

insert into auth.identities(id,user_id,identity_data,provider,provider_id,last_sign_in_at,created_at,updated_at)
select id,id,jsonb_build_object('sub',id,'email',email,'email_verified',true),'email',email,now(),now(),now() from auth.users where id::text like '10000000-%';

insert into public.profiles(id,full_name,email) values
('10000000-0000-0000-0000-000000000001','Elena Torres','admin@novalogistics.demo'),
('10000000-0000-0000-0000-000000000002','Mateo García','mateo@novalogistics.demo'),
('10000000-0000-0000-0000-000000000003','Valeria Cruz','valeria@novalogistics.demo'),
('10000000-0000-0000-0000-000000000004','Carlos Mendoza','guardia1@novalogistics.demo'),
('10000000-0000-0000-0000-000000000005','Lucía Herrera','guardia2@novalogistics.demo');
insert into public.organizations(id,name,slug) values('20000000-0000-0000-0000-000000000001','Nova Logistics','nova-logistics');
insert into public.locations(id,organization_id,name,address) values('30000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','Centro de Distribución Tijuana','Blvd. Industrial 2400, Tijuana, B.C.');
insert into public.organization_members(organization_id,profile_id,role) values
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','admin'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','host'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000003','host'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','guard'),
('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','guard');
insert into public.organization_settings(organization_id,privacy_notice) values('20000000-0000-0000-0000-000000000001','MVP demostrativo: los datos se utilizan exclusivamente para gestionar el acceso. El aviso definitivo debe ser revisado legalmente antes de producción.');

insert into public.visitors(id,organization_id,full_name,email,phone,company,document_type,document_number_masked)
select ('40000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid,'20000000-0000-0000-0000-000000000001',
  (array['Sofía Rivera','Diego Luna','Camila Ortega','Andrés Vega','Renata Silva','Javier Campos','Mariana Ríos','Emilio Navarro','Paula Castillo','Nicolás Serrano'])[1+((g-1)%10)],
  'visitante'||g||'@example.test','664000'||lpad(g::text,4,'0'),(array['Arco Studio','Lumen Tech','Órbita Legal','Punto Norte','Atlas Supply'])[1+((g-1)%5)],'INE','••••'||lpad((1000+g)::text,4,'0')
from generate_series(1,25) g;

insert into public.visits(id,organization_id,location_id,visitor_id,host_id,status,origin,purpose,visitor_company,starts_at,ends_at,checked_in_at,checked_out_at,denied_at,denial_reason,consented_at,privacy_notice_version,created_by)
select ('50000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid,'20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001',
 ('40000000-0000-0000-0000-'||lpad(g::text,12,'0'))::uuid,case when g%2=0 then '10000000-0000-0000-0000-000000000002'::uuid else '10000000-0000-0000-0000-000000000003'::uuid end,
 (array['invited','pre_registered','approved','checked_in','checked_out','denied']::public.visit_status[])[1+((g-1)%6)],'host_invitation',
 (array['Reunión comercial','Entrega de proveedor','Entrevista','Auditoría','Soporte técnico'])[1+((g-1)%5)],
 (array['Arco Studio','Lumen Tech','Órbita Legal','Punto Norte','Atlas Supply'])[1+((g-1)%5)],
 date_trunc('day',now())+((g%9)-4)*interval '1 day'+(8+(g%9))*interval '1 hour',date_trunc('day',now())+((g%9)-4)*interval '1 day'+(9+(g%9))*interval '1 hour',
 case when g%6 in (4,5) then date_trunc('day',now())+((g%9)-4)*interval '1 day'+(8+(g%9))*interval '1 hour'+interval '5 min' end,
 case when g%6=5 then date_trunc('day',now())+((g%9)-4)*interval '1 day'+(9+(g%9))*interval '1 hour'-interval '10 min' end,
 case when g%6=0 then date_trunc('day',now())+((g%9)-4)*interval '1 day'+(8+(g%9))*interval '1 hour' end,
 case when g%6=0 then 'Identificación no presentada' end,
 case when g%6<>1 then now()-interval '1 day' end,case when g%6<>1 then 'mvp-1' end,
 case when g%2=0 then '10000000-0000-0000-0000-000000000002'::uuid else '10000000-0000-0000-0000-000000000003'::uuid end
from generate_series(1,25) g;

insert into public.visit_invitations(organization_id,visit_id,token_hash,token_hint,expires_at,sent_at)
select '20000000-0000-0000-0000-000000000001',id,public.token_hash(case when id='50000000-0000-0000-0000-000000000001' then 'nexa-demo-invitation-2026' else 'seed-invite-'||id end),'••••'||right(id::text,4),ends_at+interval '1 day',now()
from public.visits where status in ('invited','pre_registered','approved');
insert into public.qr_tokens(organization_id,visit_id,token_hash,token_hint,valid_from,expires_at)
select organization_id,id,public.token_hash(case when id='50000000-0000-0000-0000-000000000003' then 'nexa-demo-pass-2026' else 'seed-pass-'||id end),'••••'||right(id::text,4),starts_at-interval '15 min',ends_at+interval '30 min'
from public.visits where status in ('pre_registered','approved','checked_in','checked_out');
insert into public.access_events(organization_id,visit_id,location_id,actor_id,event_type,occurred_at)
select organization_id,id,location_id,'10000000-0000-0000-0000-000000000004',case when status='checked_out' then 'check_out'::public.access_event_type else 'check_in'::public.access_event_type end,coalesce(checked_out_at,checked_in_at)
from public.visits where status in ('checked_in','checked_out');
insert into public.audit_logs(organization_id,actor_id,visit_id,event_type,metadata)
select organization_id,created_by,id,'invitation_created',jsonb_build_object('seed',true) from public.visits;
