[ ] Wire enhanced-rag-pipeline.ts to INSERT into qdrant_vector_ids after each chunk is indexed
[ ] Wire material delete handler to read qdrant_vector_ids, call qdrant.delete(points), then let CASCADE clean the bridge rows
