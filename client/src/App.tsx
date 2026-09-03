import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AppSplash from "./components/AppSplash";
import PWAController from "./components/PWAController";
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
import Stalla from "./pages/Stalla";
import ScenarioFuturo from "./pages/ScenarioFuturo";
import NuovoMovimento from "./pages/finanza/NuovoMovimento";
import DettaglioMovimento from "./pages/finanza/DettaglioMovimento";
import Cashflow from "./pages/finanza/Cashflow";
import Proposte from "./pages/finanza/Proposte";
import BudgetPage from "./pages/finanza/Budget";
import InvestimentiPage from "./pages/finanza/Investimenti";
import ScenariPage from "./pages/finanza/Scenari";
import AnalisiPage from "./pages/finanza/Analisi";
import ReportFinanzaPage from "./pages/finanza/Report";
import IvaPage from "./pages/finanza/Iva";
import SelezionaAzienda from "./pages/SelezionaAzienda";
import NuovaAzienda from "./pages/NuovaAzienda";
import ImpostazioniFiscali from "./pages/ImpostazioniFiscali";
import ListaMovimenti from "./pages/finanza/ListaMovimenti";
import ImpostazioniFinanza from "./pages/finanza/Impostazioni";
import ImpostazioniCategorie from "./pages/finanza/ImpostazioniCategorie";
import ImpostazioniSoggetti from "./pages/finanza/ImpostazioniSoggetti";
import ImpostazioniCentriCosto from "./pages/finanza/ImpostazioniCentriCosto";
import ImpostazioniConti from "./pages/finanza/ImpostazioniConti";
import ImpostazioniMetodi from "./pages/finanza/ImpostazioniMetodi";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/azienda" component={Azienda} />
        <Route path="/azienda/nuova" component={NuovaAzienda} />
        <Route path="/azienda/fiscale" component={ImpostazioniFiscali} />
        <Route path="/finanza">{() => <Finanza />}</Route>
        <Route path="/finanza/movimenti" component={ListaMovimenti} />
        <Route path="/finanza/nuovo" component={NuovoMovimento} />
        <Route path="/finanza/movimento/:id" component={DettaglioMovimento} />
        <Route path="/finanza/cashflow" component={Cashflow} />
        <Route path="/finanza/proposte" component={Proposte} />
        <Route path="/finanza/budget" component={BudgetPage} />
        <Route path="/finanza/reintegrazione">{() => <Finanza initialTab="reintegrazione" />}</Route>
        <Route path="/finanza/investimenti" component={InvestimentiPage} />
        <Route path="/finanza/scenari" component={ScenariPage} />
        <Route path="/finanza/analisi" component={AnalisiPage} />
        <Route path="/finanza/report" component={ReportFinanzaPage} />
        <Route path="/finanza/iva" component={IvaPage} />
        <Route path="/finanza/impostazioni" component={ImpostazioniFinanza} />
        <Route path="/finanza/impostazioni/categorie" component={ImpostazioniCategorie} />
        <Route path="/finanza/impostazioni/soggetti" component={ImpostazioniSoggetti} />
        <Route path="/finanza/impostazioni/centri-costo" component={ImpostazioniCentriCosto} />
        <Route path="/finanza/impostazioni/conti" component={ImpostazioniConti} />
        <Route path="/finanza/impostazioni/metodi-pagamento" component={ImpostazioniMetodi} />
        <Route path="/campi" component={Campi} />
        <Route path="/magazzino" component={Magazzino} />
        <Route path="/officina" component={Officina} />
        <Route path="/calendario" component={Calendario} />
        <Route path="/report" component={Report} />
        <Route path="/ai" component={AI} />
        <Route path="/stalla" component={Stalla} />
        <Route path="/reintegrazione">{() => <Finanza initialTab="reintegrazione" />}</Route>
        <Route path="/scenario-futuro" component={ScenarioFuturo} />
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
          <AppSplash />
          <PWAController />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
