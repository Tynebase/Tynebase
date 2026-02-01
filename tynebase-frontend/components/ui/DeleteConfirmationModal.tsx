"use client";

import { useState } from "react";
import { Modal, ModalFooter } from "./Modal";
import { Button } from "./Button";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  description?: string;
  itemName?: string;
  confirmButtonText?: string;
}

export function DeleteConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Delete Item",
  description,
  itemName,
  confirmButtonText = "Delete",
}: DeleteConfirmationModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
    } finally {
      setIsDeleting(false);
    }
  };

  const defaultDescription = itemName
    ? `Are you sure you want to delete "${itemName}"? This action cannot be undone.`
    : "Are you sure you want to delete this item? This action cannot be undone.";

  return (
    <Modal
      isOpen={isOpen}
      onClose={isDeleting ? () => {} : onClose}
      size="sm"
      showCloseButton={!isDeleting}
      closeOnOverlay={!isDeleting}
      closeOnEscape={!isDeleting}
    >
      <div className="flex flex-col items-center text-center">
        {/* Warning Icon */}
        <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center mb-5">
          <AlertTriangle className="w-7 h-7 text-red-500" />
        </div>

        {/* Title */}
        <h3 className="text-lg font-semibold text-[var(--dash-text-primary)] mb-2">
          {title}
        </h3>

        {/* Description */}
        <p className="text-sm text-[var(--dash-text-tertiary)] max-w-xs">
          {description || defaultDescription}
        </p>
      </div>

      <ModalFooter className="justify-center mt-6">
        <Button
          variant="outline"
          onClick={onClose}
          disabled={isDeleting}
          className="min-w-[100px]"
        >
          Cancel
        </Button>
        <Button
          variant="primary"
          onClick={handleConfirm}
          disabled={isDeleting}
          className="min-w-[100px] bg-red-500 hover:bg-red-600 border-red-500 hover:border-red-600"
        >
          {isDeleting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              {confirmButtonText}
            </>
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );
}
