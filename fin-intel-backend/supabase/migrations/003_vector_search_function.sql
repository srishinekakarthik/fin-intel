-- ============================================================
-- 003_vector_search_function.sql
-- Supabase RPC for cosine-similarity search over document_chunks
-- ============================================================

create or replace function search_document_chunks(
  query_embedding    vector(768),
  org_id_filter      uuid,
  company_id_filter  uuid        default null,
  document_ids_filter uuid[]     default null,
  match_threshold    float       default 0.65,
  match_count        int         default 8
)
returns table (
  "chunkId"    uuid,
  "documentId" uuid,
  "docTitle"   text,
  "pageNumber" int,
  "content"    text,
  "similarity" float
)
language plpgsql
security definer   -- runs as postgres, bypasses RLS for this read
as $$
begin
  return query
  select
    dc.id                                          as "chunkId",
    dc.document_id                                 as "documentId",
    d.title                                        as "docTitle",
    dc.page_number                                 as "pageNumber",
    dc.content                                     as "content",
    1 - (dc.embedding <=> query_embedding)         as "similarity"
  from document_chunks dc
  join documents d on d.id = dc.document_id
  where
    dc.org_id = org_id_filter
    and (company_id_filter is null or d.company_id = company_id_filter)
    and (document_ids_filter is null or dc.document_id = any(document_ids_filter))
    and 1 - (dc.embedding <=> query_embedding) >= match_threshold
  order by dc.embedding <=> query_embedding   -- ascending distance = descending similarity
  limit match_count;
end;
$$;

-- Grant execute to authenticated users (the function checks org_id internally)
grant execute on function search_document_chunks to authenticated;
grant execute on function search_document_chunks to service_role;
