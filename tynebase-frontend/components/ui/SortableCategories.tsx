"use client";

import React, { useState, useCallback } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  defaultDropAnimationSideEffects,
  DropAnimation,
  TouchSensor,
} from "@dnd-kit/core";
import {
  arrayMove,
  useSortable,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import { Category, updateCategory } from "@/lib/api/folders";

interface SortableCategoryItemProps {
  category: Category & { count: number };
  isSelected: boolean;
  onSelect: (id: string) => void;
  isDragOverlay?: boolean;
  isDragging?: boolean;
  showReorderButtons?: boolean;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}

function SortableCategoryItem({
  category,
  isSelected,
  onSelect,
  isDragOverlay,
  isDragging,
  showReorderButtons,
  onMoveLeft,
  onMoveRight,
  isFirst,
  isLast,
}: SortableCategoryItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragOverlay ? 50 : isDragging ? 40 : 1,
  };

  const isActive = isDragOverlay || isDragging || isSortableDragging;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-xl group transition-colors ${
        isActive ? "opacity-40" : "hover:bg-[var(--surface-hover)]"
      } ${isDragOverlay ? "bg-[var(--surface-card)] shadow-lg ring-1 ring-[var(--brand)]/30" : ""}`}
    >
      <button
        {...attributes}
        {...listeners}
        className="p-1 cursor-grab active:cursor-grabbing text-[var(--dash-text-muted)] opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label={`Drag to reorder ${category.name}`}
      >
        <GripVertical className="w-4 h-4" />
      </button>

      <button
        onClick={() => onSelect(category.id)}
        className="flex-1 flex items-center justify-between min-w-0"
      >
        <div className="flex items-center gap-2 truncate">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: category.color }}
          />
          <span
            className={`text-sm truncate transition-colors ${
              isSelected ? "font-semibold text-[var(--dash-text-primary)]" : "font-medium text-[var(--dash-text-secondary)] group-hover:text-[var(--dash-text-primary)]"
            }`}
          >
            {category.name}
          </span>
        </div>
        {isSelected && <Check className="w-4 h-4 text-[var(--brand)] flex-shrink-0 ml-2" />}
      </button>

      <span className="text-xs font-medium text-[var(--dash-text-muted)] bg-[var(--surface-ground)] px-2 py-0.5 rounded-full">
        {category.count}
      </span>
    </div>
  );
}

interface SortableCategoriesProps {
  categories: (Category & { count: number })[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  onReorder: (categories: (Category & { count: number })[]) => void;
  disabled?: boolean;
  totalDocumentsCount?: number;
}

export function SortableCategories({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onReorder,
  disabled = false,
  totalDocumentsCount = 0,
}: SortableCategoriesProps) {
  const [items, setItems] = useState(categories);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setItems(categories);
  }, [categories]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { delay: 100, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setError(null);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (over && active.id !== over.id) {
        setIsReordering(true);
        setError(null);

        try {
          const oldIndex = items.findIndex((item) => item.id === active.id);
          const newIndex = items.findIndex((item) => item.id === over.id);

          if (oldIndex !== newIndex) {
            const newItems = arrayMove(items, oldIndex, newIndex);
            setItems(newItems);

            const updates = newItems.map((item, index) => ({
              id: item.id,
              sort_order: index,
            }));

            await Promise.all(
              updates.map((update) =>
                updateCategory(update.id, { sort_order: update.sort_order })
              )
            );

            onReorder(newItems);
          }
        } catch (err) {
          console.error("Failed to reorder categories:", err);
          setError("Failed to save new order. Please try again.");
          setItems(categories);
        } finally {
          setIsReordering(false);
        }
      }
    },
    [items, categories, onReorder]
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: { active: { opacity: "0.5" } },
    }),
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  const selectedCategory = selectedCategoryId === 'all' 
    ? { id: 'all', name: 'All Categories', color: '#6b7280', count: totalDocumentsCount }
    : items.find(c => c.id === selectedCategoryId) || { id: 'unknown', name: 'Unknown', color: '#6b7280', count: 0 };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-3 px-5 py-3 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-full hover:border-[var(--brand)] hover:shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/20"
      >
        <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedCategory.color }} />
        <span className="text-sm font-medium text-[var(--dash-text-primary)]">
          {selectedCategory.name}
        </span>
        <span className="text-xs font-medium text-[var(--dash-text-muted)] bg-[var(--surface-ground)] px-2 py-0.5 rounded-full ml-1">
          {selectedCategory.count}
        </span>
        <ChevronDown className={`w-4 h-4 text-[var(--dash-text-muted)] transition-transform ml-1 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-72 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[60vh]">
          {/* Header & All Categories */}
          <div className="p-2 border-b border-[var(--dash-border-subtle)]">
            <button
              onClick={() => {
                onSelectCategory('all');
                setIsOpen(false);
              }}
              className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-[var(--surface-hover)] transition-colors group"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-gray-400" />
                <span className={`text-sm transition-colors ${selectedCategoryId === 'all' ? 'font-semibold text-[var(--dash-text-primary)]' : 'font-medium text-[var(--dash-text-secondary)] group-hover:text-[var(--dash-text-primary)]'}`}>
                  All Categories
                </span>
              </div>
              <div className="flex items-center">
                {selectedCategoryId === 'all' && <Check className="w-4 h-4 text-[var(--brand)] mr-2" />}
                <span className="text-xs font-medium text-[var(--dash-text-muted)] bg-[var(--surface-ground)] px-2 py-0.5 rounded-full">
                  {totalDocumentsCount}
                </span>
              </div>
            </button>
          </div>

          {/* Error and Loading States */}
          {error && (
            <div className="p-2">
              <div className="px-3 py-2 bg-[var(--status-error-bg)] border border-[var(--status-error)]/30 rounded-lg text-xs text-[var(--status-error)]">
                {error}
              </div>
            </div>
          )}
          {isReordering && (
            <div className="p-2 border-b border-[var(--dash-border-subtle)] bg-[var(--surface-hover)]">
              <div className="flex items-center gap-2 px-2 py-1 text-xs text-[var(--dash-text-secondary)]">
                <div className="w-3 h-3 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
                Saving order...
              </div>
            </div>
          )}

          {/* Sortable List */}
          <div className="p-2 overflow-y-auto overflow-x-hidden flex-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragOver={handleDragOver}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items.map((item) => item.id)} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-0.5">
                  {items.map((category) => (
                    <SortableCategoryItem
                      key={category.id}
                      category={category}
                      isSelected={selectedCategoryId === category.id}
                      onSelect={(id) => {
                        onSelectCategory(id);
                        setIsOpen(false);
                      }}
                      isDragging={activeId === category.id}
                    />
                  ))}
                </div>
              </SortableContext>
              <DragOverlay dropAnimation={dropAnimation}>
                {activeItem ? (
                  <SortableCategoryItem
                    category={activeItem}
                    isSelected={selectedCategoryId === activeItem.id}
                    onSelect={() => {}}
                    isDragOverlay
                  />
                ) : null}
              </DragOverlay>
            </DndContext>
          </div>
        </div>
      )}
    </div>
  );
}
