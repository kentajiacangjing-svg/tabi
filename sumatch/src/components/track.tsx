"use client";

import { useEffect } from "react";
import { trackAction } from "@/app/actions/customer";

export function Track({ kind }: { kind: "visit" | "diagnosis_start" }) {
  useEffect(() => {
    trackAction(kind).catch(() => {});
  }, [kind]);
  return null;
}
