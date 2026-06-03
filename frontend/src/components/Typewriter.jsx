import { useEffect, useState } from "react";

/**
 * Typewriter effect: types out `text` letter by letter then shows a blinking cursor.
 * Props:
 *  - text: string
 *  - speed: ms per character (default 110)
 *  - startDelay: ms before typing starts (default 600)
 *  - cursorClassName: tailwind classes for the cursor
 *  - loop: if true, after pause restarts (default false)
 *  - pauseAfter: ms to wait after fully typed before restart (only with loop)
 */
export default function Typewriter({
  text = "",
  speed = 110,
  startDelay = 600,
  className = "",
  cursorClassName = "text-ozx-primary",
  loop = false,
  pauseAfter = 2400,
  testId,
}) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    let timers = [];
    let cancelled = false;

    const run = () => {
      setDisplayed("");
      setDone(false);
      let i = 0;
      timers.push(setTimeout(function step() {
        if (cancelled) return;
        i += 1;
        setDisplayed(text.slice(0, i));
        if (i < text.length) {
          timers.push(setTimeout(step, speed));
        } else {
          setDone(true);
          if (loop) timers.push(setTimeout(run, pauseAfter));
        }
      }, startDelay));
    };

    run();
    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [text, speed, startDelay, loop, pauseAfter]);

  return (
    <span className={className} data-testid={testId}>
      {displayed}
      <span
        aria-hidden="true"
        className={`inline-block ml-1 w-[3px] sm:w-[4px] lg:w-[5px] h-[0.85em] align-[-0.05em] ${cursorClassName} bg-current`}
        style={{ animation: "ozxBlink 1s steps(1,end) infinite" }}
      />
      <style>{`@keyframes ozxBlink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }`}</style>
    </span>
  );
}
