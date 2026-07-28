import * as React from "react";
import { Link } from "@tanstack/react-router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  description: string;
  children: React.ReactNode;
  footerText: string;
  footerLinkText: string;
  footerLinkTo: string;
}

export function AuthCard({
  title,
  description,
  children,
  footerText,
  footerLinkText,
  footerLinkTo,
}: AuthCardProps) {
  return (
    <Card className="w-full max-w-md border border-border/40 bg-card/60 backdrop-blur-xl shadow-2xl transition-all duration-300 gap-4">
      <CardHeader className="space-y-1 pb-0 text-center">
        <CardTitle
          role="heading"
          aria-level={2}
          className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent transition-all duration-300"
        >
          {title}
        </CardTitle>
        <CardDescription className="text-muted-foreground text-xs sm:text-sm transition-all duration-300">
          {description}
        </CardDescription>
      </CardHeader>

      <CardContent>{children}</CardContent>

      <CardFooter className="flex justify-center border-t border-border/10 pt-3 pb-4">
        <p className="text-xs text-muted-foreground">
          {footerText}{" "}
          <Link
            to={footerLinkTo}
            className="text-primary font-medium hover:underline transition-colors"
          >
            {footerLinkText}
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
