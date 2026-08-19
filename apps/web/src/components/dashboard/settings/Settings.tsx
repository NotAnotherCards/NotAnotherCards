import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { User, Settings as SettingsIcon, Shield } from "lucide-react";
import { useStore } from "@/hooks/useStore";
import { Profile } from "./Profile";
import { Preferences } from "./Preferences";
import { Security } from "./Security";

export function Settings() {
  const { data: session } = authClient.useSession();
  const { profile } = useStore();
  const [activeSubTab, setActiveSubTab] = useState<
    "profile" | "preferences" | "security"
  >("profile");

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full py-4 animate-in fade-in duration-300">
      {/* Side info panel */}
      <div className="md:col-span-1">
        <div className="p-6 rounded-3xl bg-muted/30 border border-border/40 backdrop-blur-xs h-fit">
          <div className="size-16 rounded-full bg-linear-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-2xl shadow-inner mb-4 border border-primary/20">
            {session?.user?.name
              ? session.user.name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase()
              : "U"}
          </div>
          <h3 className="font-heading font-bold text-lg text-foreground truncate">
            {session?.user?.name || "Legendary Learner"}
          </h3>
          <p className="text-xs text-muted-foreground truncate mb-6">
            @{profile?.username || "username"}
          </p>

          {/* Navigation subtabs */}
          <div className="flex flex-col gap-1 border-t border-border/30 pt-6">
            <Button
              type="button"
              variant={activeSubTab === "profile" ? "default" : "ghost"}
              onClick={() => setActiveSubTab("profile")}
              className="w-full justify-start gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer transition-all duration-200"
            >
              <User className="size-4" />
              Profile & Languages
            </Button>
            <Button
              type="button"
              variant={activeSubTab === "preferences" ? "default" : "ghost"}
              onClick={() => setActiveSubTab("preferences")}
              className="w-full justify-start gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer transition-all duration-200"
            >
              <SettingsIcon className="size-4" />
              Preferences
            </Button>
            <Button
              type="button"
              variant={activeSubTab === "security" ? "default" : "ghost"}
              onClick={() => setActiveSubTab("security")}
              className="w-full justify-start gap-3 px-4 py-2.5 rounded-2xl text-sm font-semibold cursor-pointer transition-all duration-200"
            >
              <Shield className="size-4" />
              Security
            </Button>
          </div>
        </div>
      </div>

      {/* Main settings content */}
      <div className="md:col-span-2">
        {activeSubTab === "profile" && <Profile />}
        {activeSubTab === "preferences" && <Preferences />}
        {activeSubTab === "security" && <Security />}
      </div>
    </div>
  );
}
