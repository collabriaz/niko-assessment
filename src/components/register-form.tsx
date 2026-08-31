"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FieldErrors = Record<string, string[] | undefined>;

const FIELDS = [
  {
    name: "organisationName",
    label: "Organisation name",
    type: "text",
    hint: "The advertiser this account bills to.",
  },
  { name: "contactName", label: "Your name", type: "text", hint: null },
  { name: "email", label: "Email", type: "email", hint: null },
] as const;

export const RegisterForm = () => {
  const router = useRouter();
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [values, setValues] = useState({
    organisationName: "",
    contactName: "",
    email: "",
  });
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    setFieldErrors({});

    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify(values),
    }).catch(() => null);

    if (!response) {
      setPending(false);
      setMessage("Could not reach the server. Your details are still here.");
      return;
    }

    if (response.ok) {
      router.push("/portal");
      router.refresh();
      return;
    }

    const body = await response.json().catch(() => null);
    setPending(false);
    setFieldErrors(body?.details?.fieldErrors ?? {});
    setMessage(body?.message ?? "Registration failed. Please try again.");
  };

  return (
    <form className="space-y-5" onSubmit={submit}>
      {FIELDS.map((field) => (
        <div key={field.name} className="grid gap-1.5">
          <label className="text-sm font-medium" htmlFor={field.name}>
            {field.label}
          </label>
          <Input
            id={field.name}
            name={field.name}
            type={field.type}
            required
            aria-invalid={Boolean(fieldErrors[field.name])}
            value={values[field.name]}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                [field.name]: event.target.value,
              }))
            }
          />
          {fieldErrors[field.name] ? (
            <p className="text-sm text-destructive">
              {fieldErrors[field.name]?.at(0)}
            </p>
          ) : (
            field.hint && (
              <p className="text-sm text-muted-foreground">{field.hint}</p>
            )
          )}
        </div>
      ))}

      {message && (
        <p className="rounded-lg border border-destructive/30 bg-destructive-surface px-4 py-3 text-sm text-destructive">
          {message}
        </p>
      )}

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Creating your account" : "Create account"}
      </Button>

      <p className="text-sm text-muted-foreground">
        No contract is required. You can browse the catalogue, shortlist
        products and send a non-binding request straight away.
      </p>
    </form>
  );
};
