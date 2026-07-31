"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";

const BetaAppV52 = dynamic(() => import("./BetaAppV52"), {
  ssr: false,
  loading: () => (
    <div className="loading-state">
      <span className="loading-mark" />
      <p>Carregando a central de gestão…</p>
    </div>
  ),
});

type ClientOnlyBetaAppV52Props = {
  userName?: string | null;
  userEmail?: string | null;
  isAdmin: boolean;
};

export default function ClientOnlyBetaAppV52(
  props: ClientOnlyBetaAppV52Props,
) {
  useEffect(() => {
    const moveEnhancements = () => {
      const layer = document.querySelector<HTMLElement>(".v52-floating-layer");
      const pageArea = document.querySelector<HTMLElement>(".page-area");
      if (layer && pageArea && layer.parentElement !== pageArea) {
        pageArea.prepend(layer);
      }
    };

    moveEnhancements();
    const observer = new MutationObserver(moveEnhancements);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  return <BetaAppV52 {...props} />;
}
