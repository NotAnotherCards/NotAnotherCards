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
  Clock,
  BookMarked,
  Flame,
  GraduationCap,
  BookOpen,
  Sparkles,
  Plus,
  Play,
  LogOut,
  Mail,
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
    name: "Legendary Learner",
    email: "learner@notanothercards.com",
  };

  // Mock statistics for the language learning card app
  const stats = [
    {
      title: "Today's Reviews",
      value: "42 words",
      description: "Due for review",
      icon: Clock,
      color: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Personal Dictionary",
      value: "248 words",
      description: "Added to your collection",
      icon: BookMarked,
      color: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "Learning Streak",
      value: "7 Days",
      description: "Daily learning-day streak",
      icon: Flame,
      color: "text-orange-500 bg-orange-500/10",
    },
    {
      title: "Words Learned",
      value: "1,240 / 10,000",
      description: "12.4% total progress",
      icon: GraduationCap,
      color: "text-purple-500 bg-purple-500/10",
    },
  ];

  // Mock dictionaries from concept.md
  const readyMadeDictionaries = [
    { id: 1, name: "Top-100 words", description: "Most common foundational words", progress: "100%", percent: 100, status: "Completed" },
    { id: 2, name: "Top-300 words", description: "Essential everyday vocabulary", progress: "85%", percent: 85, status: "In Progress" },
    { id: 3, name: "Top-500 words", description: "Intermediate conversational phrases", progress: "20%", percent: 20, status: "In Progress" },
    { id: 4, name: "Top-1000 words", description: "Broad everyday comprehension", progress: "0%", percent: 0, status: "Not Started" },
    { id: 5, name: "Thematic: Business English", description: "Professional terms and jargon", progress: "0%", percent: 0, status: "Not Started" },
  ];

  // Mock daily goals
  const dailyGoals = [
    {
      id: 1,
      title: "Daily Review",
      description: "Review at least 20 words due today",
      progress: "20 / 20",
      percent: 100,
      reward: "Completed",
    },
    {
      id: 2,
      title: "New Vocabulary",
      description: "Add 10 new words to your personal dictionary",
      progress: "6 / 10",
      percent: 60,
      reward: "4 remaining",
    },
  ];

  return (
    <PageContainer
      title="Dashboard Page"
      description="Welcome to your language learning portal. Track your vocabulary review progress, explore dictionaries, and build your learning streak."
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
            <div className="size-14 rounded-full bg-linear-to-tr from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-xl shadow-inner border border-primary/20">
              {user.name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-lg font-bold truncate max-w-50" title={user.name}>
                {user.name}
              </CardTitle>
              <CardDescription className="flex items-center gap-1 text-xs truncate max-w-50" title={user.email}>
                <Mail className="size-3" />
                {user.email}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 pt-0">
            <div className="flex items-center justify-between p-3 rounded-2xl bg-muted/50 border border-border/30 text-xs">
              <span className="text-muted-foreground">Account Status</span>
              <span className="font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                DUELIST LEARNER
              </span>
            </div>
            
            <div className="flex gap-2">
              <Button className="flex-1 cursor-pointer gap-1.5" size="sm">
                <Play className="size-3.5 fill-current" />
                Start Review
              </Button>
              <Button variant="outline" className="flex-1 cursor-pointer gap-1.5" size="sm">
                <Plus className="size-3.5" />
                Add Word
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
        
        {/* Explore Dictionaries */}
        <Card className="lg:col-span-2 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-md font-bold flex items-center gap-2">
              <BookOpen className="size-4 text-primary" />
              Explore Dictionaries
            </CardTitle>
            <CardDescription>Browse and study ready-made vocabulary sets based on word frequency.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20 text-xs font-semibold text-muted-foreground">
                    <th className="px-6 py-3">Dictionary Name</th>
                    <th className="px-6 py-3">Description</th>
                    <th className="px-6 py-3">Progress</th>
                    <th className="px-6 py-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {readyMadeDictionaries.map((dict) => (
                    <tr key={dict.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-6 py-3.5 font-medium flex items-center gap-2">
                        <div className="size-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                          {dict.id}
                        </div>
                        {dict.name}
                      </td>
                      <td className="px-6 py-3.5 text-muted-foreground">{dict.description}</td>
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary rounded-full"
                              style={{ width: `${dict.percent}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">{dict.progress}</span>
                        </div>
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          dict.status === "Completed" 
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                            : dict.status === "In Progress"
                            ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {dict.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Daily Learning Goals */}
        <Card className="lg:col-span-1 border border-border/60 hover:shadow-md transition-all duration-300">
          <CardHeader className="border-b border-border/40 pb-4">
            <CardTitle className="text-md font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-amber-500" />
              Daily Learning Goals
            </CardTitle>
            <CardDescription>Complete daily tasks to unlock achievements and progress your fluency.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5 pt-4">
            {dailyGoals.map((quest) => (
              <div key={quest.id} className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">{quest.title}</span>
                  <span className="text-muted-foreground font-medium">{quest.progress}</span>
                </div>
                <p className="text-xs text-muted-foreground">{quest.description}</p>
                <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-linear-to-r from-amber-500 to-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${quest.percent}%` }}
                  />
                </div>
                <div className="flex justify-end">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    quest.percent === 100 
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  }`}>
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
