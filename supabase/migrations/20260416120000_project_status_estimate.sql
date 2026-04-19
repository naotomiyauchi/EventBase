-- 案件ステータス: 提案の次に「見積もり」を追加
alter type public.project_status add value if not exists 'estimate' after 'proposal';
