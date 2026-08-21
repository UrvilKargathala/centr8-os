export function Modal({
  onClose,
  children,
  maxWidth = "max-w-lg",
}: {
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-950/40 p-4" onClick={onClose}>
      <div
        className={`max-h-[85vh] w-full ${maxWidth} overflow-y-auto scrollbar-hide rounded-lg bg-neutral-50 dark:bg-neutral-100 backdrop-blur-xl p-6 shadow-lg border border-neutral-200`}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
