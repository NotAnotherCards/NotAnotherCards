import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/PageContainer";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Trophy,
  Gamepad2,
  TrendingUp,
  Layers,
  LogOut,
  Sparkles,
  Play,
  Plus,
  Mail,
  Sword,
} from "lucide-react";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardComponent,
});

function DashboardComponent() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await authClient.signOut();
    navigate({ to: "/login" });
  };

  const user = session?.user || {
    name: "Legendary Duelist",
    email: "duelist@notanothercards.com",
  };

  // Mock statistics for the card game app
  const stats = [
    {
      title: "Win Rate",
      value: "64.5%",
      description: "Last 30 matches",
      icon: TrendingUp,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Matches Played",
      value: "142",
      description: "Ranked & casual games",
      icon: Gamepad2,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "Cards Collected",
      value: "248 / 500",
      description: "49.6% complete set",
      icon: Layers,
      color: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "Rank & Rating",
      value: "Platinum III",
      description: "1,840 Rating Points",
      icon: Trophy,
      color: "text-purple-500 bg-purple-500/10",
    },
  ];

  // Mock recent match history
  const recentMatches = [
    {
      id: 1,
      opponent: "Kaiba_99",
      result: "Victory",
      deck: "Dragon's Fury",
      date: "2 hours ago",
      xp: "+120 XP",
    },
    {
      id: 2,
      opponent: "CardMasterX",
      result: "Defeat",
      deck: "Spellweaver Control",
      date: "5 hours ago",
      xp: "+35 XP",
    },
    {
      id: 3,
      opponent: "Muto_Y",
      result: "Victory",
      deck: "Dragon's Fury",
      date: "Yesterday",
      xp: "+150 XP",
    },
  ];

  // Mock active quests
  const activeQuests = [
    {
      id: 1,
      title: "Dragon Tamer",
      description: "Win 3 matches using a deck with 5+ dragons",
      progress: "2 / 3",
      percent: 66,
      reward: "150 Gold",
    },
    {
      id: 2,
      title: "Daily Challenger",
      description: "Play 5 matches in Ranked mode",
      progress: "4 / 5",
      percent: 80,
      reward: "100 Gold",
    },
  ];

  return (
    <PageContainer
      title="Dashboard Page"
      description="Welcome to your cards gaming portal. Track your stats, active decks, and play matches."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleLogout} className="cursor-pointer gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/10">
            <LogOut className="size-4" />
            Logout
          </Button>
        </div>
      }
    >
      {/* Overview Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Profile Card */}
        <Card className="lg:col-span-1 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="flex flex-row items-center gap-4 pb-4">
            <div className="size-14 rounded-full bg-gradient-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-xl shadow-inner border border-primary/20">
              {user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-lg font-bold truncate max-w-[200px]" title={user.name}>
                {user.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs truncate max-w-[200px]" title={user.email}>
                <Mail className="size-3" />
                {user.email}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/30 text-xs">
              <span className="text-muted-foreground">Account Status</span>
              <span className="font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                PRO DUELIST
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button className="flex-1 cursor-pointer gap-1.5" size="sm">
                <Play className="size-3.5 fill-current" />
                Find Match
              </Button>
              <Button variant="outline" className="flex-1 cursor-pointer gap-1.5" size="sm">
                <Plus className="size-3.5" />
                New Deck
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Summary Cards Grid */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {stats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <Card key={i} className="border border-border/60 hover:shadow-md transition-all duration-300">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <span className="text-sm font-medium text-muted-foreground">{stat.title}</span>
                  <div className={`p-2 rounded-xl ${stat.color}`}>
                    <Icon className="size-4" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-heading tracking-tight">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Tables and List sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Recent Matches */}
        <Card className="lg:col-span-2 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-md font-bold flex items-center gap-2">
              <Sword className="size-4 text-primary" />
              Recent Battles
            </CardTitle>
            <CardDescription>Your latest match history and battle reports.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground">
                    <th className="px-6 py-3">Opponent</th>
                    <th className="px-6 py-3">Deck</th>
                    <th className="px-6 py-3">Result</th>
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3 text-right">Rewards</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {recentMatches.map((match) => (
                    <tr key={match.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-3.5 font-medium flex items-center gap-2">
                        <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold">
                          {match.opponent.slice(0, 2).toUpperCase()}
                        </div>
                        {match.opponent}
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">{match.deck}</td>
                      <td className="px-6 py-3.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          match.result === "Victory" 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                            : "bg-destructive/10 text-destructive"
                        }`}>
                          {match.result}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground text-xs">{match.date}</td>
                      <td className="px-6 py-3.5 text-right font-medium text-primary text-xs">{match.xp}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Active Quests & Challenges */}
        <Card className="lg:col-span-1 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-md font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              Active Quests
            </CardTitle>
            <CardDescription>Complete challenges to unlock gold and card packs.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {activeQuests.map((quest) => (
              <div key={quest.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{quest.title}</span>
                  <span className="text-muted-foreground font-medium">{quest.progress}</span>
                </div>
                <p className="text-xs text-muted-foreground">{quest.description}</p>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${quest.percent}%` }}
                  />
                </div>
                <div className="flex justify-end">
                  <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold px-2 py-0.5 rounded-full">
                    {quest.reward}
                  </span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

    </PageContainer>
  );
}
