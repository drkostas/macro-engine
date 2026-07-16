import { useState } from "react";
import { ScrollView, View } from "react-native";
import {
  Text, Card, Badge, SegmentedControl, Ring, ProgressBar, MacroBar,
  Button, Pill, PillGroup, Stepper, Modal,
} from "soma-style";

const MACROS = [
  { label: "Cal", color: "#77c8d1", target: 1888 },
  { label: "Pro", color: "#b17850", target: 184 },
  { label: "Carb", color: "#6366b0", target: 144 },
  { label: "Fat", color: "#cbe896", target: 64 },
  { label: "Fiber", color: "#82d0c8", target: 31 },
];

const MEALS = [
  { name: "Breakfast", kcal: 529, segs: [{ macro: "protein", value: 46 }, { macro: "carbs", value: 40 }, { macro: "fat", value: 18 }, { macro: "fiber", value: 6 }] },
  { name: "Lunch", kcal: 472, segs: [{ macro: "protein", value: 46 }, { macro: "carbs", value: 36 }, { macro: "fat", value: 16 }, { macro: "fiber", value: 9 }] },
  { name: "Dinner", kcal: 578, segs: [{ macro: "protein", value: 59 }, { macro: "carbs", value: 53 }, { macro: "fat", value: 24 }, { macro: "fiber", value: 11 }] },
  { name: "Pre-Sleep", kcal: 156, segs: [{ macro: "protein", value: 33 }, { macro: "carbs", value: 14 }, { macro: "fat", value: 6 }, { macro: "fiber", value: 5 }] },
] as const;

export default function DashboardScreen() {
  const [tab, setTab] = useState<"Week" | "Progress" | "Year">("Week");
  const [band, setBand] = useState("Active");
  const [steps, setSteps] = useState(10000);
  const [refeed, setRefeed] = useState(false);

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-6">
      <View className="w-full max-w-2xl gap-4">
        {/* Day header */}
        <View className="flex-row items-center gap-2">
          <Text variant="title">Thursday, Jul 16</Text>
          <Badge label="Rest" tone="neutral" />
          <Badge label="T2 · Standard Cut" tone="teal" />
        </View>

        {/* Hero */}
        <Card variant="glow" className="gap-4">
          <SegmentedControl options={["Week", "Progress", "Year"] as const} value={tab} onChange={setTab} />

          <View className="flex-row items-end gap-2">
            <Text variant="display">0</Text>
            <Text variant="title" className="text-text-muted">/ 1,888 kcal</Text>
          </View>
          <Text variant="caption" className="text-danger">1,888 remaining · 0% complete</Text>

          <View className="mt-1 flex-row justify-between">
            {MACROS.map((m) => (
              <View key={m.label} className="items-center gap-1">
                <Ring pct={0} size={46} color={m.color} label="0%" />
                <Text variant="micro">{m.label}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* Activity */}
        <Card className="gap-3">
          <Text variant="eyebrow">Activity</Text>
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

        {/* Meals */}
        {MEALS.map((meal) => (
          <Card key={meal.name} className="gap-2">
            <View className="flex-row items-center justify-between">
              <Text variant="title">{meal.name}</Text>
              <Text variant="caption" className="tabular-nums text-text-secondary">{meal.kcal} kcal</Text>
            </View>
            <MacroBar segments={meal.segs as never} className="my-1" />
            <View className="flex-row items-center gap-2">
              <Button label={`Log ${meal.name}`} variant="secondary" size="sm" className="flex-1" />
              <Button label="Skip" variant="ghost" size="sm" />
            </View>
          </Card>
        ))}

        {/* Weekly deficit */}
        <Card className="gap-3">
          <Text variant="eyebrow">Weekly deficit</Text>
          <ProgressBar pct={0.72} color="#6ad4a0" />
          <View className="flex-row items-center justify-between">
            <Text variant="caption" className="text-text-secondary">Adherence</Text>
            <Text variant="caption" className="text-warning">over goal · 317%</Text>
          </View>
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
