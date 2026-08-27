"use client";

import { TextField, type TextFieldProps } from "@aisley/ui";
import { useState } from "react";
import { FiEye, FiEyeOff, FiLock } from "react-icons/fi";

type PasswordFieldProps = Omit<
  TextFieldProps,
  "leadingIcon" | "trailingElement" | "type"
>;

export function PasswordField({ label, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      {...props}
      label={label}
      type={visible ? "text" : "password"}
      leadingIcon={<FiLock className="size-[18px]" />}
      trailingElement={
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
          className="grid size-9 place-items-center rounded-lg text-[#746778] transition hover:bg-[#F7F0F9] hover:text-[#4C1268] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#4C1268]/15"
        >
          {visible ? (
            <FiEyeOff aria-hidden="true" className="size-[18px]" />
          ) : (
            <FiEye aria-hidden="true" className="size-[18px]" />
          )}
        </button>
      }
    />
  );
}
