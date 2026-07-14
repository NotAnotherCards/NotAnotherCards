import { Button } from "@/components/ui/button";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/login")({
  component: LoginComponent,
});

function LoginComponent() {
  return (
    <div>
      <form>
        <FieldSet>
          <FieldLegend>Welcome back!</FieldLegend>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="email">Email</FieldLabel>
              <Input id="email"/>
            </Field>
            <Field>
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Input id="password"/>
            </Field>
          </FieldGroup>
        </FieldSet>
        <Button type="submit" className="mt-6">Login</Button>
      </form>
    </div>
  );
}
