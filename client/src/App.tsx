import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import Azienda from "./pages/Azienda";
import Finanza from "./pages/Finanza";
import Campi from "./pages/Campi";
import Magazzino from "./pages/Magazzino";
import Officina from "./pages/Officina";
import Calendario from "./pages/Calendario";
import Report from "./pages/Report";
import AI from "./pages/AI";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/azienda" component={Azienda} />
        <Route path="/finanza" component={Finanza} />
        <Route path="/campi" component={Campi} />
        <Route path="/magazzino" component={Magazzino} />
        <Route path="/officina" component={Officina} />
        <Route path="/calendario" component={Calendario} />
        <Route path="/report" component={Report} />
        <Route path="/ai" component={AI} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
