import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, TextField, Button, Banner, Toast, Frame,
  Text, BlockStack, InlineStack, Tag, Box, Spinner, Checkbox
} from "@shopify/polaris";

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DEFAULT_HOURS = { open: "08:00", close: "18:00" };

export default function TimeSlots() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";

  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [dropoffSlots, setDropoffSlots] = useState([]);
  const [collectionSlots, setCollectionSlots] = useState([]);
  const [operatingHours, setOperatingHours] = useState({});
  const [slotCapacity, setSlotCapacity] = useState("10");
  const [newDropoff, setNewDropoff] = useState("");
  const [newCollection, setNewCollection] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/timeslots?shop=${shop}`).then(r => r.json()),
      fetch(`/api/billing/status?shop=${shop}`).then(r => r.json()),
    ]).then(([ts, status]) => {
      setDropoffSlots(ts.dropoffSlots || []);
      setCollectionSlots(ts.collectionSlots || []);
      setOperatingHours(ts.operatingHours || {});
      setSlotCapacity(String(ts.slotCapacity || 10));
      setPlan(status?.plan || "free");
    }).finally(() => setLoading(false));
  }, [shop]);

  const addSlot = (type) => {
    const val = type === "dropoff" ? newDropoff : newCollection;
    if (!val) return;
    if (type === "dropoff") {
      if (!dropoffSlots.includes(val)) setDropoffSlots([...dropoffSlots, val].sort());
      setNewDropoff("");
    } else {
      if (!collectionSlots.includes(val)) setCollectionSlots([...collectionSlots, val].sort());
      setNewCollection("");
    }
  };

  const removeSlot = (type, val) => {
    if (type === "dropoff") setDropoffSlots(dropoffSlots.filter(s => s !== val));
    else setCollectionSlots(collectionSlots.filter(s => s !== val));
  };

  const updateHours = (day, field, value) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: { ...(prev[day] || DEFAULT_HOURS), [field]: value },
    }));
  };

  const toggleDay = (day) => {
    setOperatingHours(prev => {
      const next = { ...prev };
      if (next[day]) delete next[day];
      else next[day] = { ...DEFAULT_HOURS };
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const body = { dropoffSlots, collectionSlots };
    if (plan !== "free") body.operatingHours = operatingHours;
    if (["pro", "enterprise"].includes(plan)) body.slotCapacity = parseInt(slotCapacity);
    const res = await fetch(`/api/timeslots?shop=${shop}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setSaving(false);
    if (data.upgrade) { setToast(data.error); return; }
    if (data.error) { setToast(data.error); return; }
    setToast("Time slots saved");
  };

  if (loading) return (
    <Page title="Time Slots"><Layout><Layout.Section><Card>
      <Box padding="800"><InlineStack align="center"><Spinner size="large" /></InlineStack></Box>
    </Card></Layout.Section></Layout></Page>
  );

  return (
    <Frame>
      <Page
        title="Time Slots"
        backAction={{ content: "Dashboard", onAction: () => navigate(`/?shop=${shop}`) }}
        primaryAction={{ content: "Save", loading: saving, onAction: handleSave }}
      >
        <Layout>
          {plan === "free" && (
            <Layout.Section>
              <Banner title="Basic time slots on Free plan" tone="info" action={{ content: "Upgrade", onAction: () => navigate(`/settings?shop=${shop}`) }}>
                Free plan: set drop-off and collection slots. Upgrade to Starter for custom operating hours, Pro for per-slot capacity limits.
              </Banner>
            </Layout.Section>
          )}

          {/* Drop-off slots */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Drop-off Time Slots</Text>
                <Text variant="bodySm" tone="subdued">Times customers can drop off their items.</Text>
                <InlineStack gap="200" wrap>
                  {dropoffSlots.map(s => (
                    <Tag key={s} onRemove={() => removeSlot("dropoff", s)}>{s}</Tag>
                  ))}
                </InlineStack>
                <InlineStack gap="200" blockAlign="end">
                  <TextField label="Add time" value={newDropoff} onChange={setNewDropoff} type="time" autoComplete="off" />
                  <Button onClick={() => addSlot("dropoff")}>Add</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Collection slots */}
          <Layout.Section variant="oneHalf">
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Collection Time Slots</Text>
                <Text variant="bodySm" tone="subdued">Times customers can collect their items.</Text>
                <InlineStack gap="200" wrap>
                  {collectionSlots.map(s => (
                    <Tag key={s} onRemove={() => removeSlot("collection", s)}>{s}</Tag>
                  ))}
                </InlineStack>
                <InlineStack gap="200" blockAlign="end">
                  <TextField label="Add time" value={newCollection} onChange={setNewCollection} type="time" autoComplete="off" />
                  <Button onClick={() => addSlot("collection")}>Add</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Operating hours (Starter+) */}
          {plan !== "free" && (
            <Layout.Section>
              <Card>
                <BlockStack gap="400">
                  <Text variant="headingMd" as="h2">Operating Hours</Text>
                  <Text variant="bodySm" tone="subdued">Toggle days on/off and set opening and closing times.</Text>
                  {DAYS.map(day => {
                    const enabled = Boolean(operatingHours[day]);
                    const hours = operatingHours[day] || DEFAULT_HOURS;
                    return (
                      <InlineStack key={day} gap="400" blockAlign="center" wrap={false}>
                        <Box minWidth="120px">
                          <Checkbox label={day.charAt(0).toUpperCase() + day.slice(1)} checked={enabled} onChange={() => toggleDay(day)} />
                        </Box>
                        {enabled && (
                          <>
                            <TextField label="Open" value={hours.open} onChange={v => updateHours(day, "open", v)} type="time" autoComplete="off" />
                            <TextField label="Close" value={hours.close} onChange={v => updateHours(day, "close", v)} type="time" autoComplete="off" />
                          </>
                        )}
                      </InlineStack>
                    );
                  })}
                </BlockStack>
              </Card>
            </Layout.Section>
          )}

          {/* Slot capacity (Pro+) */}
          {["pro", "enterprise"].includes(plan) && (
            <Layout.Section>
              <Card>
                <BlockStack gap="300">
                  <Text variant="headingMd" as="h2">Slot Capacity</Text>
                  <Text variant="bodySm" tone="subdued">Maximum number of bookings allowed per time slot.</Text>
                  <TextField label="Capacity per slot" value={slotCapacity} onChange={setSlotCapacity} type="number" min="1" autoComplete="off" />
                </BlockStack>
              </Card>
            </Layout.Section>
          )}
        </Layout>

        {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
      </Page>
    </Frame>
  );
}
