import { useEffect, useRef, useState } from "react";

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  );
}

// Animate a number from its previously displayed value to `target` whenever
// `target` changes. Returns the current in-flight value; format at the call
// site so integer counts and durations can share one hook. If interrupted,
// the next run continues from wherever the last one stopped.
export function useCountUp(target: number, duration = 650): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef<number>();

  useEffect(() => {
    if (prefersReducedMotion() || fromRef.current === target) {
      fromRef.current = target;
      setValue(target);
      return;
    }

    const from = fromRef.current;
    const delta = target - from;
    const start = performance.now();

    const frame = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const v = from + delta * easeOutCubic(t);
      fromRef.current = v; // so an interrupt resumes from here
      setValue(v);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        fromRef.current = target;
      }
    };

    rafRef.current = requestAnimationFrame(frame);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration]);

  return value;
}
