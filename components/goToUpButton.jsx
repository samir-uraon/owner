
"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function GoUpButton() {
  const [show, setShow] = useState(false);
  const [position, setPosition] = useState({ x: 20, y: 20 });
  const [dragging, setDragging] = useState(false);

  const buttonRef = useRef(null);
  const moved = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const positionRef = useRef(position);

  // Show button after scrolling 100px
  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Restore saved position
  useEffect(() => {
    const saved = localStorage.getItem("go-up-position");

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        const next = {
          x: Math.max(0, Math.min(window.innerWidth - 48, parsed.x)),
          y: Math.max(0, Math.min(window.innerHeight - 48, parsed.y)),
        };

        positionRef.current = next;
        setPosition(next);
      } catch {}
    }
  }, []);

  // Drag start
  const handlePointerDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();

    moved.current = false;

    start.current = {
      x: e.clientX,
      y: e.clientY,
    };

    offset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  };

  // Drag movement
  const handlePointerMove = (e) => {
    if (!dragging) return;

    const dx = e.clientX - start.current.x;
    const dy = e.clientY - start.current.y;

    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      moved.current = true;
    }

    if (!moved.current) return;

    const size = buttonRef.current?.offsetWidth || 48;

    const next = {
      x: Math.max(
        0,
        Math.min(window.innerWidth - size, e.clientX - offset.current.x)
      ),
      y: Math.max(
        0,
        Math.min(window.innerHeight - size, e.clientY - offset.current.y)
      ),
    };

    positionRef.current = next;
    setPosition(next);
  };

  // Drag end
  const handlePointerUp = () => {
    setDragging(false);

    if (moved.current) {
      localStorage.setItem(
        "go-up-position",
        JSON.stringify(positionRef.current)
      );
    }
  };

  // Scroll to top
  const goToTop = () => {
    if (moved.current) return;

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  // Hide button before 100px scroll
  if (!show) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Go to top"
      title="Drag to move or click to go to top"
      onClick={goToTop}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={`fixed z-[99999] flex h-12 w-12 touch-none select-none items-center justify-center rounded-full bg-gray-500 text-white shadow-xl hover:bg-gray-700 active:scale-95 ${
        dragging ? "cursor-grabbing" : "cursor-grab"
      }`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <ArrowUp size={22} strokeWidth={2.5} />
    </button>
  );
}
