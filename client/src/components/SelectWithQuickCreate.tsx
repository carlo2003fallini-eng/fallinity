import { useState, useMemo, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Plus, Search, MoreHorizontal, Pencil, Settings2, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface SelectOption {
  id: string;
  label: string;
  sublabel?: string;
  color?: string;
}

interface QuickCreateField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
  type?: "text" | "select";
  options?: { value: string; label: string }[];
}

interface SelectWithQuickCreateProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  // Quick create
  quickCreateTitle?: string;
  quickCreateFields?: QuickCreateField[];
  onQuickCreate?: (data: Record<string, string>) => Promise<string | void>; // returns new id
  // Manage link
  managePath?: string;
  onManage?: () => void;
  // Search
  searchable?: boolean;
  // Recents
  recentIds?: string[];
}

export function SelectWithQuickCreate({
  label,
  value,
  onChange,
  options,
  placeholder = "Seleziona...",
  quickCreateTitle,
  quickCreateFields = [],
  onQuickCreate,
  managePath,
  onManage,
  searchable = true,
  recentIds = [],
}: SelectWithQuickCreateProps) {
  const [showPicker, setShowPicker] = useState(false);
  const [showQuickCreate, setShowQuickCreate] = useState(false);
  const [search, setSearch] = useState("");
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState(false);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    if (!search) return options;
    const s = search.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(s) || o.sublabel?.toLowerCase().includes(s));
  }, [options, search]);

  const recents = useMemo(() => {
    if (!recentIds.length) return [];
    return recentIds.map((id) => options.find((o) => o.id === id)).filter(Boolean) as SelectOption[];
  }, [recentIds, options]);

  function handleSelect(id: string) {
    onChange(id);
    setShowPicker(false);
    setSearch("");
  }

  async function handleQuickCreate() {
    if (!onQuickCreate) return;
    setCreating(true);
    try {
      const newId = await onQuickCreate(formData);
      if (newId) onChange(newId);
      setShowQuickCreate(false);
      setFormData({});
    } catch (e: any) {
      // error handled by caller
    } finally {
      setCreating(false);
    }
  }

  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-1.5 mt-1">
        {/* Main select button */}
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="flex-1 h-10 px-3 rounded-lg border border-border/40 bg-white/[0.03] text-left flex items-center gap-2 hover:bg-white/[0.05] transition-colors"
        >
          {selected ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {selected.color && <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: selected.color }} />}
              <span className="text-sm truncate">{selected.label}</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">{placeholder}</span>
          )}
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        </button>

        {/* Quick create button */}
        {onQuickCreate && (
          <button
            type="button"
            onClick={() => { setFormData({}); setShowQuickCreate(true); }}
            className="w-10 h-10 rounded-lg border border-border/40 bg-white/[0.03] flex items-center justify-center hover:bg-primary/10 hover:border-primary/30 transition-colors"
          >
            <Plus className="w-4 h-4 text-primary" />
          </button>
        )}

        {/* More menu */}
        {(managePath || onManage) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="w-10 h-10 rounded-lg border border-border/40 bg-white/[0.03] flex items-center justify-center hover:bg-white/[0.05] transition-colors">
                <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {selected && <DropdownMenuItem onClick={() => { /* could open edit */ }}><Pencil className="w-4 h-4 mr-2" />Modifica selezionato</DropdownMenuItem>}
              <DropdownMenuItem onClick={onManage}><Settings2 className="w-4 h-4 mr-2" />Gestisci tutti</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Picker Sheet */}
      <Sheet open={showPicker} onOpenChange={setShowPicker}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>{label}</SheetTitle></SheetHeader>
          <div className="mt-3 space-y-3">
            {searchable && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Cerca..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10" autoFocus />
              </div>
            )}
            {/* Recents */}
            {!search && recents.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Recenti</p>
                {recents.map((o) => (
                  <button key={o.id} onClick={() => handleSelect(o.id)} className="w-full text-left px-3 py-2 rounded-lg hover:bg-white/5 flex items-center gap-2">
                    {o.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: o.color }} />}
                    <span className="text-sm">{o.label}</span>
                  </button>
                ))}
              </div>
            )}
            {/* All options */}
            <div>
              {!search && recents.length > 0 && <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 mt-2">Tutti</p>}
              {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nessun risultato</p>}
              {filtered.map((o) => (
                <button
                  key={o.id}
                  onClick={() => handleSelect(o.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 transition-colors ${
                    value === o.id ? "bg-primary/10 text-primary" : "hover:bg-white/5"
                  }`}
                >
                  {o.color && <div className="w-3 h-3 rounded-full" style={{ backgroundColor: o.color }} />}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm">{o.label}</span>
                    {o.sublabel && <span className="text-[10px] text-muted-foreground ml-2">{o.sublabel}</span>}
                  </div>
                  {value === o.id && <div className="w-2 h-2 rounded-full bg-primary" />}
                </button>
              ))}
            </div>
            {/* Quick create from picker */}
            {onQuickCreate && (
              <button
                onClick={() => { setShowPicker(false); setFormData({}); setShowQuickCreate(true); }}
                className="w-full text-left px-3 py-2.5 rounded-lg flex items-center gap-2 text-primary hover:bg-primary/5"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">{quickCreateTitle || `Nuovo ${label.toLowerCase()}`}</span>
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Quick Create Sheet */}
      <Sheet open={showQuickCreate} onOpenChange={setShowQuickCreate}>
        <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>{quickCreateTitle || `Nuovo ${label.toLowerCase()}`}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3 pb-6">
            {quickCreateFields.map((field) => (
              <div key={field.key}>
                <Label>{field.label}{field.required && " *"}</Label>
                {field.type === "select" && field.options ? (
                  <select
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    className="w-full mt-1 h-10 px-3 rounded-lg border border-border/40 bg-white/[0.03] text-sm"
                  >
                    <option value="">Seleziona...</option>
                    {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                ) : (
                  <Input
                    value={formData[field.key] || ""}
                    onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="mt-1"
                  />
                )}
              </div>
            ))}
            <Button onClick={handleQuickCreate} className="w-full" disabled={creating}>
              Crea e seleziona
            </Button>
            {managePath && (
              <button onClick={onManage} className="w-full text-center text-xs text-primary hover:underline mt-2">
                Completa anagrafica / Gestisci tutti
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
