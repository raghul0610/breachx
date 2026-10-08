-- Breach X initial competition content.
-- Run after the schema migration.

insert into public.events (name, status)
values ('Breach X', 'DRAFT')
on conflict do nothing;

with event_row as (
  select id from public.events where name = 'Breach X' order by created_at limit 1
)
insert into public.event_config (event_id)
select id from event_row
on conflict (event_id) do nothing;

with event_row as (
  select id from public.events where name = 'Breach X' order by created_at limit 1
)
insert into public.tracks (event_id, name, slug, description)
select id, 'Cyber Arena', 'gaming', 'Cybersecurity challenges for competitive gaming infrastructure.'
from event_row
union all
select id, 'Secure Sports Intelligence', 'sports', 'Cybersecurity challenges for sensitive athlete and sports intelligence systems.'
from event_row
union all
select id, 'SocialShield', 'social-media', 'Cyber-resilient social platforms operating with untrusted users and content.'
from event_row
on conflict (event_id, slug) do nothing;

with tracks as (
  select t.id, t.slug
  from public.tracks t
  join public.events e on e.id = t.event_id
  where e.name = 'Breach X'
)
insert into public.problem_statements (track_id, title, statement)
select id, 'Secure Competitive Gaming Infrastructure',
'Design a secure, highly available infrastructure for an online competitive gaming platform. Protect real-time game communication and game-state services against cheating, API abuse, account takeover, forged requests, DDoS attacks, and unauthorized access to internal services.'
from tracks where slug = 'gaming'
union all
select id, 'Secure Athlete Intelligence Platform',
'Design a zero-trust security architecture for a sports intelligence platform collecting sensitive athlete data from wearables, training systems, medical-performance systems, and coaching applications. Protect against unauthorized access, insider threats, privilege escalation, compromised devices, API attacks, and data leakage.'
from tracks where slug = 'sports'
union all
select id, 'Cyber-Resilient Social Network',
'Design the security architecture for a large-scale social platform where users create posts, upload media, send private messages, and join communities. Defend against account takeover, malicious uploads, phishing, spam, bot attacks, scraping, privilege escalation, privacy violations, and unauthorized access to private data.'
from tracks where slug = 'social-media'
on conflict do nothing;
