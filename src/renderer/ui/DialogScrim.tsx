import { useRef, type PointerEvent, type ReactNode } from "react";

interface DialogScrimProps {
  children: ReactNode;
  className?: string;
  onClose: () => void;
  role?: string;
}

export const DialogScrim = ({
  children,
  className = "dialog-scrim",
  onClose,
  role,
}: DialogScrimProps) => {
  const pressStartedOnScrimRef = useRef(false);

  const handlePointerDownCapture = (event: PointerEvent<HTMLDivElement>) => {
    pressStartedOnScrimRef.current = event.target === event.currentTarget;
  };

  const closeFromScrimPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const shouldClose =
      pressStartedOnScrimRef.current && event.target === event.currentTarget;
    pressStartedOnScrimRef.current = false;

    if (shouldClose) {
      onClose();
    }
  };

  return (
    <div
      className={className}
      role={role}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerUpCapture={closeFromScrimPointerUp}
    >
      {children}
    </div>
  );
};
