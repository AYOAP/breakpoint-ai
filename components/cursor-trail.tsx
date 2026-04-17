"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

interface Spark {
  id: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  size: number;
  duration: number;
}

export function CursorTrail() {
  const [enabled, setEnabled] = useState(false);
  const [suppressed, setSuppressed] = useState(false);
  const [pointer, setPointer] = useState({ x: -120, y: -120 });
  const [sparks, setSparks] = useState<Spark[]>([]);

  const sparkIdRef = useRef(0);
  const pointerRef = useRef({ x: -120, y: -120 });

  useEffect(() => {
    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");

    const updateEnabled = () => {
      setEnabled(mediaQuery.matches);
    };

    updateEnabled();
    mediaQuery.addEventListener("change", updateEnabled);

    return () => {
      mediaQuery.removeEventListener("change", updateEnabled);
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      setSparks([]);
      setPointer({ x: -120, y: -120 });
      return;
    }

    let animationFrame = 0;

    const clearPointer = () => {
      setPointer({ x: -120, y: -120 });
      pointerRef.current = { x: -120, y: -120 };
      setSparks([]);
    };

    const isTextEntryTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;

      const tagName = target.tagName.toLowerCase();
      return (
        tagName === "textarea" ||
        (tagName === "input" && !["button", "checkbox", "radio", "range", "submit"].includes((target as HTMLInputElement).type)) ||
        target.isContentEditable
      );
    };

    const spawnSparks = (x: number, y: number, intensity = 2, radius = 0) => {
      const cluster = Array.from({ length: intensity }, () => {
        sparkIdRef.current += 1;
        const angle = Math.random() * Math.PI * 2;
        const offset = Math.random() * radius;

        return {
          id: sparkIdRef.current,
          x: x + Math.cos(angle) * offset,
          y: y + Math.sin(angle) * offset,
          dx: Math.cos(angle) * (10 + Math.random() * 20),
          dy: Math.sin(angle) * (8 + Math.random() * 22) - Math.random() * 10,
          size: 2 + Math.random() * 5,
          duration: 0.4 + Math.random() * 0.35,
        };
      });

      setSparks((current) => [...current.slice(-20), ...cluster]);

      cluster.forEach((spark) => {
        window.setTimeout(() => {
          setSparks((current) => current.filter((entry) => entry.id !== spark.id));
        }, spark.duration * 1000);
      });
    };

    const emberInterval = window.setInterval(() => {
      const currentPoint = pointerRef.current;

      if (suppressed || currentPoint.x < 0) return;
      spawnSparks(currentPoint.x, currentPoint.y, 3, 7);
    }, 56);

    const onPointerMove = (event: PointerEvent) => {
      cancelAnimationFrame(animationFrame);

      animationFrame = window.requestAnimationFrame(() => {
        setSuppressed(false);
        const nextPoint = { x: event.clientX, y: event.clientY };
        setPointer(nextPoint);
        pointerRef.current = nextPoint;
        spawnSparks(nextPoint.x, nextPoint.y, 2, 4);
      });
    };

    const onPointerDown = (event: PointerEvent) => {
      setSuppressed(false);
      spawnSparks(event.clientX, event.clientY, 10, 8);
    };

    const onPointerLeave = (event: MouseEvent) => {
      if (event.relatedTarget === null) {
        clearPointer();
      }
    };

    const onFocusIn = (event: FocusEvent) => {
      if (isTextEntryTarget(event.target)) {
        setSuppressed(true);
        clearPointer();
      }
    };

    const onFocusOut = () => {
      const activeElement = document.activeElement;

      if (!isTextEntryTarget(activeElement)) {
        setSuppressed(false);
      }
    };

    const onKeyDown = () => {
      if (isTextEntryTarget(document.activeElement)) {
        setSuppressed(true);
        clearPointer();
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        clearPointer();
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("mouseout", onPointerLeave);
    window.addEventListener("focusin", onFocusIn);
    window.addEventListener("focusout", onFocusOut);
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.clearInterval(emberInterval);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("mouseout", onPointerLeave);
      window.removeEventListener("focusin", onFocusIn);
      window.removeEventListener("focusout", onFocusOut);
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [enabled, suppressed]);

  if (!enabled || suppressed) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-0 z-50 hidden lg:block">
      <AnimatePresence>
        {sparks.map((spark) => (
          <motion.span
            key={spark.id}
            initial={{ opacity: 0, scale: 0.25 }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.25, 1, 0.2],
              x: spark.dx,
              y: spark.dy,
            }}
            exit={{ opacity: 0, scale: 0 }}
            transition={{ duration: spark.duration, ease: "easeOut" }}
            className="absolute rounded-full bg-[radial-gradient(circle,rgba(255,252,252,1),rgba(255,122,124,0.86),rgba(255,77,79,0))] shadow-[0_0_20px_rgba(255,77,79,0.46)] mix-blend-screen"
            style={{
              left: spark.x,
              top: spark.y,
              width: spark.size,
              height: spark.size,
            }}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
