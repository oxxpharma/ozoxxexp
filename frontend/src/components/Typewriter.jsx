import { useEffect, useState } from "react";

/**
 * Typewriter with optional erase-and-retype loop.
 * Props:
 *  - text: string to type
 *  - speed: ms per char while typing (default 110)
 *  - eraseSpeed: ms per char while erasing (default 60)
 *  - startDelay: ms before first type (default 600)
 *  - holdAfterTyped: ms to hold full text before erasing (loop only) (default 2400)
 *  - holdAfterErased: ms to hold empty before retyping (loop only) (default 500)
 *  - loop: if true, erases and retypes forever
 *  - showCursor: render the blinking cursor (default true)
 */
export default function Typewriter({
  text = "",
  speed = 110,
  eraseSpeed = 60,
  startDelay = 600,
  holdAfterTyped = 2400,
  holdAfterErased = 500,
  loop = false,
  showCursor = true,
  className = "",
  cursorClassName = "text-ozx-primary",
  testId,
  onDone,
}) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let timers = [];
    let cancelled = false;
    const schedule = (fn, ms) => {
      const id = setTimeout(() => { if (!cancelled) fn(); }, ms);
      timers.push(id);
    };

    const typeFn = () => {
      let i = 0;
      const tick = () => {
        if (cancelled) return;
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i < text.length) {
          schedule(tick, speed);
        } else {
          if (onDone) onDone();
          if (loop) schedule(eraseFn, holdAfterTyped);
        }
      };
      schedule(tick, 0);
    };

    const eraseFn = () => {
      let i = text.length;
      const tick = () => {
        if (cancelled) return;
        i -= 1;
        setDisplayed(text.slice(0, Math.max(0, i)));
        if (i > 0) {
          schedule(tick, eraseSpeed);
        } else {
          schedule(typeFn, holdAfterErased);
        }
      };
      schedule(tick, 0);
    };

    setDisplayed("");
    schedule(typeFn, startDelay);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [text, speed, eraseSpeed, startDelay, holdAfterTyped, holdAfterErased, loop]); // eslint-disable-line

  return (
    <span className={className} data-testid={testId}>
      {displayed}
      {showCursor && (
        <>
          <span
            aria-hidden="true"
            className={`inline-block ml-1 w-[2px] sm:w-[3px] lg:w-[4px] h-[0.85em] align-[-0.05em] ${cursorClassName} bg-current`}
            style={{ animation: "ozxBlink 1s steps(1,end) infinite" }}
          />
          <style>{`@keyframes ozxBlink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }`}</style>
        </>
      )}
    </span>
  );
}
