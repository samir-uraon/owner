"use client";

import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export default function GoUpButton() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShow(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  const goToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={goToTop}
      aria-label="Go to top"
      className="fixed bottom-5 right-5 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-slate-500 hover:bg-slate-600 text-white shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 sm:bottom-9 sm:right-12"
    >
      <ArrowUp size={20} />
    </button>
  );
}