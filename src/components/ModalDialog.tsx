import { useEffect, useRef, type ReactNode } from "react";
import { AlertCircle, AlertTriangle, Check, Info, Trash2, X } from "lucide-react";
import "./ModalDialog.css";

export type ModalType = "info" | "warning" | "danger" | "prompt";

export interface ModalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  type?: ModalType;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => void;
  isDestructive?: boolean;
  confirmDisabled?: boolean;
}

export function ModalDialog({
  isOpen,
  onClose,
  title,
  type = "info",
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  isDestructive = false,
  confirmDisabled = false,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case "danger":
        return <Trash2 size={20} className="modal-icon-danger" />;
      case "warning":
        return <AlertTriangle size={20} className="modal-icon-warning" />;
      case "prompt":
        return <Check size={20} className="modal-icon-primary" />;
      default:
        return <Info size={20} className="modal-icon-info" />;
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-container" onClick={(e) => e.stopPropagation()} ref={dialogRef}>
        <div className="modal-header">
          <div className="modal-header-icon-title">
            <div className="modal-icon-wrapper">{getIcon()}</div>
            <h3 id="modal-title" className="modal-title">{title}</h3>
          </div>
          <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close dialog">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {children}
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn modal-btn-secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          {onConfirm && (
            <button
              type="button"
              className={`modal-btn ${isDestructive ? "modal-btn-danger" : "modal-btn-primary"}`}
              onClick={onConfirm}
              disabled={confirmDisabled}
            >
              {confirmLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

