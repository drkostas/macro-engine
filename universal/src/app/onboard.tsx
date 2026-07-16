import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, Card, Input, Button, Pill, PillGroup } from "soma-style";

/**
 * "Set Up Your Profile" — the macro-engine onboarding / nutrition-profile screen,
 * rebuilt on the universal soma-style component library (web + native).
 */
export default function OnboardScreen() {
  const [sex, setSex] = useState<"Male" | "Female">("Male");
  const [activity, setActivity] = useState("Active");
  const [goal, setGoal] = useState("Lose Fat");
  const [deficit, setDeficit] = useState("500");
  const [weight, setWeight] = useState("80");
  const [height, setHeight] = useState("177");
  const [age, setAge] = useState("30");
  const [bf, setBf] = useState("15");
  const [steps, setSteps] = useState("10000");

  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-10">
      <View className="w-full max-w-xl gap-6">
        <View className="gap-1">
          <Text variant="headline">Set Up Your Profile</Text>
          <Text variant="body" className="text-text-secondary">
            We'll calculate your targets from this info.
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

        <Button label="Calculate My Targets" variant="primary" size="lg" />
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
