import { OfficinaPage } from "./OfficinaLayout";
import OperatoreTab from "./OperatoreTab";
import MezziTab from "./MezziTab";
import InterventiTab from "./InterventiTab";
import RicambiTab from "./RicambiTab";

const SECTIONS = { operatore: { title: "Menù operatore", component: OperatoreTab }, mezzi: { title: "Mezzi", component: MezziTab }, interventi: { title: "Interventi", component: InterventiTab }, ricambi: { title: "Ricambi", component: RicambiTab } };
export default function OfficinaSection({ section }: { section: keyof typeof SECTIONS }) {
  const { title, component: Component } = SECTIONS[section];
  return <OfficinaPage title={title}><Component key={section} /></OfficinaPage>;
}
