import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, TextField, Button, Badge, Toast, Frame,
  Text, BlockStack, InlineStack, Tag, Checkbox, ProgressBar, Box
} from "@shopify/polaris";

const PLANS = {
  free:       { name: "Free",       price: 0,  features: ["1 service type", "Basic time slots", "Up to 20 bookings/month"] },
  starter:    { name: "Starter",    price: 19, features: ["Unlimited service types", "Add-ons", "Custom time slots", "Unlimited bookings"] },
  pro:        { name: "Pro",        price: 39, features: ["Everything in Starter", "Booking calendar", "Capacity limits per slot", "Confirmation emails", "Analytics"] },
  enterprise: { name: "Enterprise", price: 79, features: ["Everything in Pro", "Multi-location", "Custom branding", "API access"] },
};

export default function Settings() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";

  const [data, setData] = useState(null);
  const [locationAddress, setLocationAddress] = useState("");
  const [locationMapsUrl, setLocationMapsUrl] = useState("");
  const [locationWazeUrl, setLocationWazeUrl] = useState("");
  const [overnightEnabled, setOvernightEnabled] = useState(false);
  const [trustMessages, setTrustMessages] = useState([]);
  const [newTrust, setNewTrust] = useState("");
  const [pickupInstructions, setPickupInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const [subscribing, setSubscribing] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetch(`/api/settings?shop=${shop}`).then(r => r.json()).then(d => {
      setData(d);
      setLocationAddress(d.locationAddress || "");
      setLocationMapsUrl(d.locationMapsUrl || "");
      setLocationWazeUrl(d.locationWazeUrl || "");
      setOvernightEnabled(d.overnightEnabled || false);
      setTrustMessages(d.trustMessages || []);
      setPickupInstructions(d.pickupInstructions || "");
    });
  }, [shop]);

  const addTrust = () => {
    if (!newTrust.trim()) return;
    setTrustMessages([...trustMessages, newTrust.trim()]);
    setNewTrust("");
  };
  const removeTrust = (i) => setTrustMessages(trustMessages.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    const res = await fetch(`/api/settings?shop=${shop}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locationAddress, locationMapsUrl, locationWazeUrl, overnightEnabled, trustMessages, pickupInstructions }),
    });
    await res.json();
    setSaving(false);
    setToast("Settings saved");
  };

  const handleSubscribe = async (planKey) => {
    setSubscribing(planKey);
    const res = await fetch(`/api/billing/subscribe?shop=${shop}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planKey }),
    });
    const d = await res.json();
    setSubscribing(null);
    if (d.confirmationUrl) window.top.location.href = d.confirmationUrl;
    else setToast(d.error || "Failed to start subscription");
  };

  if (!data) return <Page title="Settings"><Card><Box padding="400"><Text>Loading...</Text></Box></Card></Page>;

  const currentPlan = data.plan || "free";
  const limit = data.bookingLimit;
  const used = data.monthlyCount || 0;

  return (
    <Frame>
      <Page
        title="Settings"
        backAction={{ content: "Dashboard", onAction: () => navigate(`/?shop=${shop}`) }}
        primaryAction={{ content: "Save settings", loading: saving, onAction: handleSave }}
      >
        <Layout>
          {/* Location */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text variant="headingMd" as="h2">Location Details</Text>
                <TextField label="Address" value={locationAddress} onChange={setLocationAddress} placeholder="42 Example Street, London EC1A 1AA" autoComplete="off" />
                <TextField label="Google Maps URL" value={locationMapsUrl} onChange={setLocationMapsUrl} placeholder="https://goo.gl/maps/..." autoComplete="off" />
                <TextField label="Waze URL" value={locationWazeUrl} onChange={setLocationWazeUrl} placeholder="https://waze.com/ul?..." autoComplete="off" />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Trust messages */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Trust Messages</Text>
                <Text variant="bodySm" tone="subdued">Short trust signals shown in the booking widget (e.g. "CCTV monitored", "Bags tagged &amp; logged").</Text>
                <InlineStack gap="200" wrap>
                  {trustMessages.map((msg, i) => (
                    <Tag key={i} onRemove={() => removeTrust(i)}>{msg}</Tag>
                  ))}
                </InlineStack>
                <InlineStack gap="200" blockAlign="end">
                  <TextField label="Add message" value={newTrust} onChange={setNewTrust} placeholder="e.g. CCTV monitored" autoComplete="off" />
                  <Button onClick={addTrust}>Add</Button>
                </InlineStack>
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Pickup instructions */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Pickup Instructions</Text>
                <TextField
                  label="Instructions shown at checkout"
                  value={pickupInstructions}
                  onChange={setPickupInstructions}
                  multiline={3}
                  placeholder="e.g. Head to the front desk and show your order confirmation. We're open Mon–Sat 08:00–20:00."
                  autoComplete="off"
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Overnight toggle */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text variant="headingMd" as="h2">Overnight Storage</Text>
                <Checkbox
                  label="Enable overnight storage option"
                  checked={overnightEnabled}
                  onChange={setOvernightEnabled}
                  helpText="Allows customers to select a collection date after the drop-off date."
                />
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Usage */}
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack gap="200" blockAlign="center">
                  <Text variant="headingMd" as="h2">Usage</Text>
                  <Badge tone={currentPlan === "pro" || currentPlan === "enterprise" ? "success" : currentPlan === "starter" ? "info" : undefined}>
                    {PLANS[currentPlan]?.name || "Free"}
                  </Badge>
                </InlineStack>
                {limit ? (
                  <>
                    <Text>{used} / {limit} bookings this month</Text>
                    <ProgressBar progress={Math.round((used / limit) * 100)} size="small" />
                  </>
                ) : (
                  <Text>{used} bookings this month (unlimited)</Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* Plans */}
          <Layout.Section>
            <Text variant="headingMd" as="h2">Plans</Text>
          </Layout.Section>

          {Object.entries(PLANS).map(([key, plan]) => (
            <Layout.Section variant="oneQuarter" key={key}>
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Text variant="headingMd" as="h3">{plan.name}</Text>
                    {key === currentPlan && <Badge tone="success">Current</Badge>}
                  </InlineStack>
                  <Text variant="headingXl">{plan.price === 0 ? "Free" : `$${plan.price}/mo`}</Text>
                  <BlockStack gap="100">
                    {plan.features.map(f => <Text key={f} variant="bodySm">{f}</Text>)}
                  </BlockStack>
                  {key !== "free" && key !== currentPlan && (
                    <Button variant="primary" loading={subscribing === key} onClick={() => handleSubscribe(key)}>
                      Upgrade to {plan.name}
                    </Button>
                  )}
                </BlockStack>
              </Card>
            </Layout.Section>
          ))}
        </Layout>

        {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
      </Page>
    </Frame>
  );
}
