import { useState, useCallback, useMemo } from 'react';

export interface BulkSelection<T> {
  selectedIds: string[];
  selectedItems: T[];
  selectedCount: number;
  allSelected: boolean;
  isSelected: (id: string) => boolean;
  toggle: (id: string) => void;
  selectAll: () => void;
  deselectAll: () => void;
  clearAll: () => void;
  toggleAll: () => void;
  selectPage: (pageIds: string[]) => void;
}

/**
 * Generic hook for managing bulk ID-based selection.
 * Operates on the currently visible data slice (supports filtering/pagination).
 */
export function useBulkSelection<T>(
  data: T[],
  getId: (item: T) => string,
): BulkSelection<T> {
  const [selectedSet, setSelectedSet] = useState<Set<string>>(new Set());

  const dataIds = useMemo(() => data.map(getId), [data, getId]);

  const toggle = useCallback((id: string) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      for (const id of dataIds) next.add(id);
      return next;
    });
  }, [dataIds]);

  const deselectAll = useCallback(() => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      for (const id of dataIds) next.delete(id);
      return next;
    });
  }, [dataIds]);

  const clearAll = useCallback(() => {
    setSelectedSet(new Set());
  }, []);

  const toggleAll = useCallback(() => {
    const allIn = dataIds.length > 0 && dataIds.every((id) => selectedSet.has(id));
    if (allIn) deselectAll();
    else selectAll();
  }, [dataIds, selectedSet, selectAll, deselectAll]);

  const selectPage = useCallback((pageIds: string[]) => {
    setSelectedSet((prev) => {
      const next = new Set(prev);
      for (const id of pageIds) next.add(id);
      return next;
    });
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedSet.has(id),
    [selectedSet],
  );

  const allSelected = useMemo(
    () => dataIds.length > 0 && dataIds.every((id) => selectedSet.has(id)),
    [dataIds, selectedSet],
  );

  const selectedIds = useMemo(
    () => Array.from(selectedSet),
    [selectedSet],
  );

  const selectedItems = useMemo(
    () => data.filter((item) => selectedSet.has(getId(item))),
    [data, getId, selectedSet],
  );

  const selectedCount = selectedSet.size;

  return {
    selectedIds,
    selectedItems,
    selectedCount,
    allSelected,
    isSelected,
    toggle,
    selectAll,
    deselectAll,
    clearAll,
    toggleAll,
    selectPage,
  };
}
