/**
 * Cursor-based pagination utilities for Drizzle ORM
 * Essential for scale (Phase 5) when querying large lists of students or materials
 * 
 * Usage:
 * const result = await getPaginated(db.select().from(table).where(...), {
 *   cursor: req.query.cursor,
 *   limit: 50,
 *   cursorColumn: table.id
 * });
 */
import { lt, desc, asc, gt, SQL, eq, and, or } from 'drizzle-orm';
import { AnyMySqlSelect } from 'drizzle-orm/mysql-core';

export interface PaginationArgs {
  cursor?: string | null;
  limit?: number;
  cursorColumn: any; // Drizzle column object
  direction?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

export async function getPaginated<T extends AnyMySqlSelect>(
  query: T,
  options: PaginationArgs
): Promise<PaginatedResult<Awaited<T>[number]>> {
  const limit = options.limit || 50;
  const direction = options.direction || 'desc';
  
  // Clone the query and add limit + 1 to check if there are more results
  let paginatedQuery = query.$dynamic();
  
  // Apply cursor logic
  if (options.cursor) {
    const cursorCondition = direction === 'desc' 
      ? lt(options.cursorColumn, options.cursor)
      : gt(options.cursorColumn, options.cursor);
      
    // @ts-ignore - Drizzle $dynamic types can be tricky
    paginatedQuery = paginatedQuery.where(cursorCondition);
  }
  
  // Apply ordering
  // @ts-ignore
  paginatedQuery = paginatedQuery.orderBy(
    direction === 'desc' ? desc(options.cursorColumn) : asc(options.cursorColumn)
  );
  
  // Fetch one extra to determine hasMore
  // @ts-ignore
  paginatedQuery = paginatedQuery.limit(limit + 1);

  // Execute query safely
  const results = await paginatedQuery;
  
  const hasMore = results.length > limit;
  const data = hasMore ? results.slice(0, limit) : results;
  
  // Calculate next cursor
  let nextCursor = null;
  if (hasMore && data.length > 0) {
    // We assume the cursor column is returned and it's named identically to the column key
    // This requires the caller to ensure the cursor column is in the select set
    const lastObject = data[data.length - 1] as any;
    const columnName = options.cursorColumn.name;
    nextCursor = lastObject[columnName] ? String(lastObject[columnName]) : null;
  }
  
  return {
    data: data as any[],
    nextCursor,
    hasMore
  };
}
