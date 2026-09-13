import { useState } from "react";
import { ScrollView, View } from "react-native";
import { useRouter } from "expo-router";
import { Text, Card, Input, Button, Pill, PillGroup } from "soma-style";
import { saveOnboard } from "../lib/api";

const GOAL_MAP: Record<string, string> = { "Lose Fat": "lose_fat", Maintain: "maintain", "Build Muscle": "build_muscle" };

/**
 * "Set Up Your Profile" — the macro-engine onboarding / nutrition-profile screen,
 * rebuilt on the universal soma-style component library (web + native).
 */
export default function OnboardScreen() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sex, setSex] = useState<"Male" | "Female">("Male");
  const [activity, setActivity] = useState("Active");
  const [goal, setGoal] = useState("Lose Fat");
  const [deficit, setDeficit] = useState("500");
  const [weight, setWeight] = useState("80");
  const [height, setHeight] = useState("177");
  const [age, setAge] = useState("30");
  const [bf, setBf] = useState("15");
  const [steps, setSteps] = useState("10000");

  async function onSubmit() {
    setSaving(true);
    const ok = await saveOnboard({
      weight_kg: Number(weight),
      height_cm: Number(height),
      age: Number(age),
      sex: sex.toLowerCase(),
      goal: GOAL_MAP[goal] ?? "lose_fat",
      daily_deficit: Number(deficit),
      estimated_bf_pct: Number(bf),
      target_bf_pct: Number(bf),
      step_goal: Number(steps),
      activity_level: activity.toLowerCase().replace(" ", "_"),
    });
    setSaving(false);
    if (ok) router.replace("/dashboard");
  }

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-10">
      <View className="w-full max-w-xl gap-6">
        <View className="gap-1">
          <Text variant="headline">Set Up Your Profile</Text>
          <Text variant="body" className="text-text-secondary">
            We&apos;ll calculate your targets from this info.
          </Text>
        </View>

        {/* Body */}
        <Card className="gap-4">
          <Text variant="title">Body</Text>
          <View className="flex-row gap-3">
            <Field label="Weight (kg)" value={weight} onChangeText={setWeight} />
            <Field label="Height (cm)" value={height} onChangeText={setHeight} />
            <Field label="Age" value={age} onChangeText={setAge} />
          </View>
          <PillGroup>
            {(["Male", "Female"] as const).map((s) => (
              <Pill key={s} label={s} active={sex === s} onPress={() => setSex(s)} className="flex-1" />
            ))}
          </PillGroup>
          <View className="gap-1.5">
            <Text variant="eyebrow">Activity level</Text>
            <PillGroup>
              {["Sedentary", "Light", "Active", "Very Active"].map((a) => (
                <Pill key={a} label={a} active={activity === a} onPress={() => setActivity(a)} />
              ))}
            </PillGroup>
          </View>
        </Card>

        {/* Goal */}
        <Card className="gap-4">
          <Text variant="title">Goal</Text>
          <PillGroup>
            {["Lose Fat", "Maintain", "Build Muscle"].map((g) => (
              <Pill key={g} label={g} tone="warm" active={goal === g} onPress={() => setGoal(g)} className="flex-1" />
            ))}
          </PillGroup>
          <View className="gap-1.5">
            <Text variant="eyebrow">Daily deficit (kcal)</Text>
            <PillGroup>
              {["300", "500", "800"].map((d) => (
                <Pill key={d} label={d} active={deficit === d} onPress={() => setDeficit(d)} className="flex-1" />
              ))}
            </PillGroup>
          </View>
          <Field label="Target body fat %" value={bf} onChangeText={setBf} full />
          <Field label="Daily step goal" value={steps} onChangeText={setSteps} full />
        </Card>

        <Button label={saving ? "Saving…" : "Calculate My Targets"} variant="primary" size="lg" disabled={saving} onPress={onSubmit} />
      </View>
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  full,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  full?: boolean;
}) {
  return (
    <View className={`gap-1.5 ${full ? "w-full" : "flex-1"}`}>
      <Text variant="micro">{label}</Text>
      <Input value={value} onChangeText={onChangeText} keyboardType="numeric" />
    </View>
  );
}
