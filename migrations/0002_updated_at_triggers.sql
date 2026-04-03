CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_documents_updated_at ON documents;
CREATE TRIGGER trg_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_chunks_updated_at ON chunks;
CREATE TRIGGER trg_chunks_updated_at
BEFORE UPDATE ON chunks
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_crawl_queue_updated_at ON crawl_queue;
CREATE TRIGGER trg_crawl_queue_updated_at
BEFORE UPDATE ON crawl_queue
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
