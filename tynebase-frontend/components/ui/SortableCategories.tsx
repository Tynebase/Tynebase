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
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
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
      className={`flex items-center gap-1 ${isActive ? "opacity-90" : ""}`}
    >
      {/* Keyboard reorder buttons - visible when focused/hovered */}
      {showReorderButtons && (
        <div className="flex items-center gap-0.5">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveLeft?.();
            }}
            disabled={isFirst}
            className="p-1 rounded hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--dash-text-tertiary)]"
            aria-label={`Move ${category.name} left`}
            title="Move left"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMoveRight?.();
            }}
            disabled={isLast}
            className="p-1 rounded hover:bg-[var(--surface-hover)] disabled:opacity-30 disabled:cursor-not-allowed text-[var(--dash-text-tertiary)]"
            aria-label={`Move ${category.name} right`}
            title="Move right"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="p-1.5 rounded hover:bg-[var(--surface-hover)] cursor-grab active:cursor-grabbing text-[var(--dash-text-muted)] opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
        aria-label={`Drag to reorder ${category.name}`}
        title="Drag to reorder"
      >
        <GripVertical className="w-4 h-4" />
      </button>

      {/* Category button */}
      <button
        onClick={() => onSelect(category.id)}
        className={`px-5 py-3 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
          isSelected
            ? "bg-[var(--brand)] text-white shadow-sm"
            : "bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] text-[var(--dash-text-secondary)] hover:border-[var(--brand)] hover:text-[var(--brand)]"
        } ${isActive ? "shadow-lg ring-2 ring-[var(--brand)]/20" : ""}`}
      >
        <span
          className="w-3 h-3 rounded-sm"
          style={{
            backgroundColor: isSelected ? "white" : category.color,
          }}
        />
        {category.name}
        <span
          className={`px-1.5 py-0.5 text-xs rounded-md ${
            isSelected
              ? "bg-white/20 text-white"
              : "bg-[var(--surface-ground)] text-[var(--dash-text-muted)]"
          }`}
        >
          {category.count}
        </span>
      </button>
    </div>
  );
}

interface SortableCategoriesProps {
  categories: (Category & { count: number })[];
  selectedCategoryId: string;
  onSelectCategory: (id: string) => void;
  onReorder: (categories: (Category & { count: number })[]) => void;
  disabled?: boolean;
}

export function SortableCategories({
  categories,
  selectedCategoryId,
  onSelectCategory,
  onReorder,
  disabled = false,
}: SortableCategoriesProps) {
  const [items, setItems] = useState(categories);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update items when categories prop changes
  React.useEffect(() => {
    setItems(categories);
  }, [categories]);

  // Configure sensors for drag detection
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 8,
      },
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

            // Update sort_order in backend
            const updates = newItems.map((item, index) => ({
              id: item.id,
              sort_order: index,
            }));

            // Update all affected categories
            await Promise.all(
              updates.map((update) =>
                updateCategory(update.id, { sort_order: update.sort_order })
              )
            );

            // Notify parent of new order
            onReorder(newItems);
          }
        } catch (err) {
          console.error("Failed to reorder categories:", err);
          setError("Failed to save new order. Please try again.");
          // Revert to original order
          setItems(categories);
        } finally {
          setIsReordering(false);
        }
      }
    },
    [items, categories, onReorder]
  );

  // Handle keyboard reordering
  const handleMoveCategory = useCallback(
    async (index: number, direction: "left" | "right") => {
      if (isReordering) return;

      const newIndex = direction === "left" ? index - 1 : index + 1;
      if (newIndex < 0 || newIndex >= items.length) return;

      setIsReordering(true);
      setError(null);

      try {
        const newItems = arrayMove(items, index, newIndex);
        setItems(newItems);

        // Update sort_order in backend
        const updates = newItems.map((item, idx) => ({
          id: item.id,
          sort_order: idx,
        }));

        await Promise.all(
          updates.map((update) =>
            updateCategory(update.id, { sort_order: update.sort_order })
          )
        );

        onReorder(newItems);
      } catch (err) {
        console.error("Failed to reorder categories:", err);
        setError("Failed to save new order. Please try again.");
        setItems(categories);
      } finally {
        setIsReordering(false);
      }
    },
    [items, categories, onReorder, isReordering]
  );

  const dropAnimation: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
      styles: {
        active: {
          opacity: "0.5",
        },
      },
    }),
  };

  const activeItem = activeId ? items.find((item) => item.id === activeId) : null;

  return (
    <div className="relative">
      {/* Error message */}
      {error && (
        <div className="mb-2 px-3 py-2 bg-[var(--status-error-bg)] border border-[var(--status-error)]/30 rounded-lg text-sm text-[var(--status-error)]">
          {error}
        </div>
      )}

      {/* Reordering indicator */}
      {isReordering && (
        <div className="absolute inset-0 bg-[var(--surface-card)]/50 backdrop-blur-sm rounded-xl flex items-center justify-center z-20">
          <div className="flex items-center gap-2 px-4 py-2 bg-[var(--surface-card)] border border-[var(--dash-border-subtle)] rounded-lg shadow-lg">
            <div className="w-4 h-4 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-[var(--dash-text-secondary)]">Saving order...</span>
          </div>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="flex flex-wrap gap-2">
            {items.map((category, index) => (
              <div key={category.id} className="group relative">
                <SortableCategoryItem
                  category={category}
                  isSelected={selectedCategoryId === category.id}
                  onSelect={onSelectCategory}
                  isDragging={activeId === category.id}
                  showReorderButtons={!disabled}
                  onMoveLeft={() => handleMoveCategory(index, "left")}
                  onMoveRight={() => handleMoveCategory(index, "right")}
                  isFirst={index === 0}
                  isLast={index === items.length - 1}
                />
              </div>
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

      {/* Instructions for screen readers */}
      <div className="sr-only" role="status" aria-live="polite">
        Categories can be reordered by dragging or using the arrow buttons that appear on focus.
        {activeId && `Currently dragging ${items.find((i) => i.id === activeId)?.name}.`}
      </div>
    </div>
  );
}
