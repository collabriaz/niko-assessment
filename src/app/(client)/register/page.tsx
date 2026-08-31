import { RegisterForm } from "@/components/register-form";

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-3xl font-semibold tracking-tight">
        Create a client account
      </h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        This is a prototype registration. It creates a fictional user and a
        client organisation, and is not real authentication.
      </p>
      <RegisterForm />
    </div>
  );
}
