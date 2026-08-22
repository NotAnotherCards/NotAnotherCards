import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Settings as SettingsIcon } from "lucide-react";
import { ThemeChanger } from "@/components/ThemeChanger";

export function Preferences() {
  return (
    <div className="space-y-6">
      <Card className="border border-border/60 shadow-xs rounded-3xl">
        <CardHeader className="flex flex-row items-center gap-3 pb-4">
          <div className="p-2 bg-primary/10 rounded-2xl text-primary">
            <SettingsIcon className="size-5" />
          </div>
          <div>
            <CardTitle className="text-base font-bold">Preferences</CardTitle>
            <CardDescription className="text-xs">
              Customize your application settings and appearance
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-foreground">Theme</span>
            <span className="text-xs text-muted-foreground">
              Select how the application looks to you
            </span>
            <div className="mt-1">
              <ThemeChanger />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
