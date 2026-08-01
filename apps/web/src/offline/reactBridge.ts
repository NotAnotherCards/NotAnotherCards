import { useState, useEffect, useMemo } from "react";
import { Query, Model } from "@remelondb/core";

/**
 * A thin React bridge hook that subscribes to a remelonDB Query object.
 * Re-renders automatically whenever local SQLite data matching the query changes.
 *
 * @param queryOrFactory A Query instance or a factory function returning a Query instance
 * @param deps Dependency array when using a factory function
 */
export function useQuery<M>(
  queryOrFactory:
    Query<M> | (() => Query<M> | null | undefined) | null | undefined,
  deps: unknown[] = [],
): {
  data: M[];
  isLoading: boolean;
  error: Error | null;
} {
  const [data, setData] = useState<M[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const query = useMemo(() => {
    if (typeof queryOrFactory === "function") {
      return queryOrFactory();
    }
    return queryOrFactory;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    typeof queryOrFactory === "function" ? undefined : queryOrFactory,
    ...deps,
  ]);

  useEffect(() => {
    if (!query) {
      setData([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = query.observe((records) => {
        setData(records);
        setIsLoading(false);
      });
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [query]);

  return { data, isLoading, error };
}

/**
 * React bridge hook to observe the count of records matching a remelonDB Query.
 */
export function useQueryCount<M>(
  queryOrFactory:
    Query<M> | (() => Query<M> | null | undefined) | null | undefined,
  deps: unknown[] = [],
): number {
  const [count, setCount] = useState<number>(0);

  const query = useMemo(() => {
    if (typeof queryOrFactory === "function") {
      return queryOrFactory();
    }
    return queryOrFactory;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    typeof queryOrFactory === "function" ? undefined : queryOrFactory,
    ...deps,
  ]);

  useEffect(() => {
    if (!query) {
      setCount(0);
      return;
    }

    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = query.observeCount((newCount) => {
        setCount(newCount);
      });
    } catch (err) {
      console.error("Failed to observe query count:", err);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [query]);

  return count;
}

/**
 * React bridge hook to observe a single remelonDB Model instance.
 * Updates whenever the model is updated in the database or becomes null on deletion.
 */
export function useRecord<M extends Model>(
  record: M | null | undefined,
): M | null {
  const [currentRecord, setCurrentRecord] = useState<M | null>(record ?? null);

  useEffect(() => {
    if (!record) {
      setCurrentRecord(null);
      return;
    }

    setCurrentRecord(record);
    let unsubscribe: (() => void) | undefined;

    try {
      unsubscribe = record.observe((updated) => {
        setCurrentRecord(updated);
      });
    } catch (err) {
      console.error("Failed to observe record:", err);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [record]);

  return currentRecord;
}
