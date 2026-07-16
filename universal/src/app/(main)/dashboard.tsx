import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Text, Card, Badge, SegmentedControl, Ring, ProgressBar, MacroBar,
  Button, Pill, PillGroup, Stepper, Modal,
} from "soma-style";
import { usePlan, type MacroSet } from "../../lib/api";

const DATE = "2026-07-16";

const MACRO_KEYS = [
  { key: "calories", label: "Cal", color: "#77c8d1" },
  { key: "protein", label: "Pro", color: "#b17850" },
  { key: "carbs", label: "Carb", color: "#6366b0" },
  { key: "fat", label: "Fat", color: "#cbe896" },
  { key: "fiber", label: "Fiber", color: "#82d0c8" },
] as const;

export default function DashboardScreen() {
  const { data, loading, error } = usePlan(DATE);
  const [tab, setTab] = useState<"Week" | "Progress" | "Year">("Week");
  const [band, setBand] = useState("Active");
  const [steps, setSteps] = useState(10000);
  const [refeed, setRefeed] = useState(false);

  const targets = data?.targets;
  const eaten = data?.eaten;
  const remaining = data?.remaining;
  const pct = (k: keyof MacroSet) =>
    targets && targets[k] > 0 ? Math.min((eaten?.[k] ?? 0) / targets[k], 1) : 0;

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-6">
      <View className="w-full max-w-2xl gap-4">
        <View className="flex-row items-center gap-2">
          <Text variant="title">Thursday, Jul 16</Text>
          {targets?.band ? <Badge label={targets.band} tone="neutral" /> : null}
          {targets?.tier ? <Badge label={`${targets.tier} · Standard Cut`} tone="teal" /> : null}
        </View>

        {error ? (
          <Card><Text variant="body" className="text-danger">API: {error} — is macro-engine running on :3457?</Text></Card>
        ) : null}

        {/* Hero */}
        <Card variant="glow" className="gap-4">
          <SegmentedControl options={["Week", "Progress", "Year"] as const} value={tab} onChange={setTab} />
          <View className="flex-row items-end gap-2">
            <Text variant="display">{loading ? "…" : (eaten?.calories ?? 0).toLocaleString()}</Text>
            <Text variant="title" className="text-text-muted">/ {(targets?.calories ?? 0).toLocaleString()} kcal</Text>
          </View>
          <Text variant="caption" className="text-danger">
            {(remaining?.calories ?? 0).toLocaleString()} remaining · {targets?.calories ? Math.round(((eaten?.calories ?? 0) / targets.calories) * 100) : 0}% complete
          </Text>
          <View className="mt-1 flex-row justify-between">
            {MACRO_KEYS.map((m) => (
              <View key={m.key} className="items-center gap-1">
                <Ring pct={pct(m.key as keyof MacroSet)} size={46} color={m.color} label={`${Math.round(pct(m.key as keyof MacroSet) * 100)}%`} />
                <Text variant="micro">{m.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Activity */}
        <Card className="gap-3">
          <Text variant="eyebrow">Activity · BMR {data?.tdee?.bmr ?? "—"} − Deficit {data?.tdee?.deficit ?? "—"}</Text>
          <View className="flex-row items-center justify-between">
            <Button label="Run OFF" variant="secondary" size="sm" />
            <Stepper value={steps} onChange={setSteps} step={1000} min={0} />
          </View>
          <PillGroup>
            {["Sedentary", "Light", "Active", "Very Active"].map((b) => (
              <Pill key={b} label={b} active={band === b} onPress={() => setBand(b)} />
            ))}
          </PillGroup>
        </Card>

        {/* Meals from real slot budgets */}
        {(data?.slotBudgets ?? [])
          .filter((s) => s.calories > 0)
          .map((slot) => (
            <Card key={slot.slot} className="gap-2">
              <View className="flex-row items-center justify-between">
                <Text variant="title" className="capitalize">{slot.slot.replace("_", " ")}</Text>
                <Text variant="caption" className="tabular-nums text-text-secondary">{Math.round(slot.calories)} kcal</Text>
              </View>
              <MacroBar
                segments={[
                  { macro: "protein", value: slot.protein },
                  { macro: "carbs", value: slot.carbs },
                  { macro: "fat", value: slot.fat },
                  { macro: "fiber", value: slot.fiber },
                ]}
                className="my-1"
              />
              <View className="flex-row items-center gap-2">
                <Button label={`Log ${slot.slot}`} variant="secondary" size="sm" className="flex-1" />
                <Button label="Skip" variant="ghost" size="sm" />
              </View>
            </Card>
          ))}

        {/* Weekly deficit */}
        <Card className="gap-3">
          <Text variant="eyebrow">Weekly deficit</Text>
          <ProgressBar pct={0.72} color="#6ad4a0" />
          <Button label="Plan a refeed" variant="primary" onPress={() => setRefeed(true)} />
        </Card>
      </View>

      <Modal visible={refeed} onClose={() => setRefeed(false)} title="Plan a refeed">
        <Text variant="body" className="text-text-secondary">
          A refeed raises carbs for a day to ease a long deficit. Your targets update instantly.
        </Text>
        <View className="mt-4 flex-row justify-end gap-2">
          <Button label="Cancel" variant="ghost" onPress={() => setRefeed(false)} />
          <Button label="Add refeed" variant="primary" onPress={() => setRefeed(false)} />
        </View>
      </Modal>
    </ScrollView>
  );
}
