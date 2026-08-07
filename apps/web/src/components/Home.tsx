import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Layers } from "lucide-react";

export function HomeComponent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center shadow-xl border-border">
        <CardHeader className="space-y-3 pb-2 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2 shadow-inner">
            <Layers className="h-10 w-10 stroke-[2.2]" />
          </div>
          <CardTitle className="text-xl xs:text-2xl sm:text-3xl font-extrabold tracking-tight">
            NotAnotherCards
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground font-medium max-w-xs leading-relaxed">
            Master any language with smart flashcards.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6 space-y-3">
          <Button
            asChild
            size="default"
            className="w-full text-sm font-semibold shadow"
          >
            <Link to="/login">Sign In</Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="default"
            className="w-full text-sm font-semibold"
          >
            <Link to="/register">Get Started</Link>
          </Button>
        </CardContent>
        <CardFooter className="justify-center pt-2 pb-6">
          <p className="text-[11px] text-muted-foreground">
            Start learning offline or sync seamlessly across your devices.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
