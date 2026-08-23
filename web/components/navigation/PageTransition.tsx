"use client";

import {useEffect, useState} from "react";

type PageTransitionProps = {
  children: React.ReactNode;
};

export default function PageTransition({
  children,
}: PageTransitionProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div
      className={`
        transition-all
        duration-500
        ease-[cubic-bezier(0.22,1,0.36,1)]
        ${
          visible
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0"
        }
      `}
    >
      {children}
    </div>
  );
}