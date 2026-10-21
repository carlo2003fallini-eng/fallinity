import { useLocation } from "wouter";
import AnimaliTab from "./AnimaliTab";

export default function TuttiAnimali() {
  const [, setLocation] = useLocation();
  return <AnimaliTab anagraficaCompleta onBack={() => setLocation("/stalla/gruppi")} />;
}
