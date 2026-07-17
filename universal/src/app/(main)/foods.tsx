import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, SegmentedControl, Input, Card, MacroBar, Pill, PillGroup, Button, Badge } from "soma-style";
import { useFoodSearch, logMeal, type FoodResult } from "../../lib/api";

const DATE = "2026-07-16";
const SLOTS = ["breakfast", "lunch", "dinner", "pre_sleep"];

export default function FoodsScreen() {
  const [tab, setTab] = useState<"Search Foods" | "Create Custom">("Search Foods");
  const [q, setQ] = useState("");
  const [slot, setSlot] = useState("lunch");
  const [logged, setLogged] = useState<Record<number, boolean>>({});
  const { results, loading } = useFoodSearch(q);

  async function onLog(f: FoodResult) {
    const ok = await logMeal(DATE, slot, f);
    if (ok) setLogged((s) => ({ ...s, [f.id]: true }));
  }

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-6">
      <View className="w-full max-w-2xl gap-4">
        <View className="gap-1">
          <Text variant="headline">Food Library</Text>
          <Text variant="body" className="text-text-secondary">
            Browse ingredients, search USDA foods, and manage your custom foods.
          </Text>
        </View>
        <SegmentedControl options={["Search Foods", "Create Custom"] as const} value={tab} onChange={setTab} className="self-start" />

        {tab === "Search Foods" ? (
          <View className="gap-3">
            <Input placeholder="Search foods (e.g. chicken breast, banana, rice)…" value={q} onChangeText={setQ} />
            <View className="gap-1.5">
              <Text variant="eyebrow">Log to</Text>
              <PillGroup>
                {SLOTS.map((s) => (
                  <Pill key={s} label={s.replace("_", " ")} active={slot === s} onPress={() => setSlot(s)} className="capitalize" />
                ))}
              </PillGroup>
            </View>
            {q.trim().length >= 2 && loading ? (
              <Text variant="caption" className="text-text-muted">Searching…</Text>
            ) : null}
            {results.map((f) => (
              <Card key={f.id} className="gap-2">
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-2">
                    <Text variant="body" className="text-text">{f.name}</Text>
                    <Text variant="micro">{f.serving_description} · {Math.round(f.calories)} kcal</Text>
                  </View>
                  <View className="flex-row items-center gap-3">
                    <Macro label="P" v={f.protein} cls="text-warm" />
                    <Macro label="C" v={f.carbs} cls="text-indigo" />
                    <Macro label="F" v={f.fat} cls="text-lime" />
                  </View>
                </View>
                <MacroBar
                  segments={[
                    { macro: "protein", value: f.protein },
                    { macro: "carbs", value: f.carbs },
                    { macro: "fat", value: f.fat },
                    { macro: "fiber", value: f.fiber || 0.001 },
                  ]}
                />
                {logged[f.id] ? (
                  <Badge label={`Logged to ${slot.replace("_", " ")}`} tone="success" />
                ) : (
                  <Button label={`Log to ${slot.replace("_", " ")}`} variant="primary" size="sm" className="self-start" onPress={() => onLog(f)} />
                )}
              </Card>
            ))}
            {q.trim().length >= 2 && !loading && results.length === 0 ? (
              <Text variant="caption" className="text-text-muted">No matches.</Text>
            ) : null}
          </View>
        ) : (
          <View className="gap-3">
            <Input placeholder="Custom food name" />
            <View className="flex-row gap-3">
              <Input placeholder="kcal" keyboardType="numeric" className="flex-1" />
              <Input placeholder="protein g" keyboardType="numeric" className="flex-1" />
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Macro({ label, v, cls }: { label: string; v: number; cls: string }) {
  return (
    <View className="items-center">
      <Text variant="caption" className={`font-semibold tabular-nums ${cls}`}>{Math.round(v)}</Text>
      <Text variant="micro">{label}</Text>
    </View>
  );
}
