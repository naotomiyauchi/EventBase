"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  label: string;
  latFieldName: string;
  lngFieldName: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
};

export function LocationSubmitButton({
  label,
  latFieldName,
  lngFieldName,
  className,
  variant = "default",
  size = "sm",
}: Props) {
  const [loading, setLoading] = useState(false);

  function submitWithLocation(button: HTMLButtonElement, lat?: number, lng?: number) {
    const form = button.closest("form");
    if (!form) return;
    const latInput = form.querySelector(
      `input[name="${latFieldName}"]`
    ) as HTMLInputElement | null;
    const lngInput = form.querySelector(
      `input[name="${lngFieldName}"]`
    ) as HTMLInputElement | null;
    if (latInput && lat != null) latInput.value = String(lat);
    if (lngInput && lng != null) lngInput.value = String(lng);
    form.requestSubmit();
  }

  function onClick(e: React.MouseEvent<HTMLButtonElement>) {
    const btn = e.currentTarget;
    if (!navigator.geolocation) {
      submitWithLocation(btn);
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLoading(false);
        submitWithLocation(btn, pos.coords.latitude, pos.coords.longitude);
      },
      () => {
        setLoading(false);
        submitWithLocation(btn);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onClick}
      disabled={loading}
    >
      {loading ? "位置取得中…" : label}
    </Button>
  );
}
