import { useState } from "react";
import { ScrollView, View } from "react-native";
import { Text, Card, Input, Button, Pill, PillGroup } from "soma-style";

const TABS = ["Profile", "Deficit mode", "Body comp", "Goals", "Activity", "Reminders"];

function Row({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View className="flex-row items-center justify-between border-b border-border-subtle py-3">
      <Text variant="body" className="text-text-secondary">{label}</Text>
      <View className="flex-row items-center gap-2">
        <Input defaultValue={value} keyboardType="numeric" className="w-24 text-center" />
        {unit ? <Text variant="caption" className="text-text-muted">{unit}</Text> : null}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const [tab, setTab] = useState("Profile");
  return (
    <ScrollView className="flex-1 bg-base" contentContainerClassName="items-center px-5 py-6">
      <View className="w-full max-w-2xl gap-4">
        <Text variant="headline">Settings</Text>
        <PillGroup>
          {TABS.map((t) => (
            <Pill key={t} label={t} active={tab === t} onPress={() => setTab(t)} />
          ))}
        </PillGroup>

        <Card className="gap-1">
          <Text variant="title" className="mb-2">Personal info</Text>
          <Row label="Weight" value="80" unit="kg" />
          <Row label="Height" value="177" unit="cm" />
          <Row label="Age" value="30" unit="yrs" />
          <Row label="Current BF%" value="21.3" unit="%" />
        </Card>

        <Card className="gap-3">
          <Text variant="title">Data</Text>
          <Button label="Export CSV" variant="secondary" size="sm" className="self-start" />
        </Card>
      </View>
    </ScrollView>
  );
}
