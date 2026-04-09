import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, Banner, Button, Text, BlockStack, InlineStack,
  Badge, DataTable, Spinner, Box, ProgressBar
} from "@shopify/polaris";

export default function Dashboard() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";
  const [status, setStatus] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/billing/status?shop=${shop}`).then(r => r.json()),
      fetch(`/api/bookings?shop=${shop}`).then(r => r.json()),
    ]).then(([s, b]) => {
      setStatus(s);
      setBookings(b.bookings || []);
    }).finally(() => setLoading(false));
  }, [shop]);

  if (loading) return (
    <Page title="Local Booking">
      <Layout><Layout.Section><Card>
        <Box padding="800"><InlineStack align="center"><Spinner size="large" /></InlineStack></Box>
      </Card></Layout.Section></Layout>
    </Page>
  );

  const limit = status?.bookingLimit;
  const used = status?.monthlyCount || 0;
  const usagePercent = limit ? Math.round((used / limit) * 100) : 0;

  const upcoming = bookings.filter(b => b.status === "pending" || b.status === "confirmed").slice(0, 5);
  const revenue = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);

  return (
    <Page
      title="Local Booking"
      primaryAction={{ content: "Manage services", onAction: () => navigate(`/services?shop=${shop}`) }}
    >
      <Layout>
        {status?.plan === "free" && limit && used >= limit - 5 && (
          <Layout.Section>
            <Banner
              title="Approaching monthly booking limit"
              tone="warning"
              action={{ content: "Upgrade plan", onAction: () => navigate(`/settings?shop=${shop}`) }}
            >
              {limit - used} bookings remaining this month on the Free plan.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Bookings This Month</Text>
              {limit ? (
                <>
                  <ProgressBar progress={usagePercent} size="small" />
                  <Text variant="bodySm">{used} / {limit}</Text>
                </>
              ) : (
                <Text variant="headingXl" as="p">{used}</Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Plan</Text>
              <Badge tone={status?.plan === "pro" || status?.plan === "enterprise" ? "success" : status?.plan === "starter" ? "info" : undefined}>
                {status?.plan ? status.plan.charAt(0).toUpperCase() + status.plan.slice(1) : "Free"}
              </Badge>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section variant="oneThird">
          <Card>
            <BlockStack gap="200">
              <Text variant="headingSm" as="h3">Total Revenue</Text>
              <Text variant="headingXl" as="p">${revenue.toFixed(2)}</Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between">
                <Text variant="headingMd" as="h2">Upcoming Bookings</Text>
                <Button variant="plain" onClick={() => navigate(`/bookings?shop=${shop}`)}>View all</Button>
              </InlineStack>
              {upcoming.length === 0 ? (
                <Text tone="subdued">No upcoming bookings yet.</Text>
              ) : (
                <DataTable
                  columnContentTypes={["text", "text", "text", "text", "numeric"]}
                  headings={["Drop-off", "Collection", "Status", "Created", "Total"]}
                  rows={upcoming.map(b => [
                    `${b.dropoffDate} ${b.dropoffTime}`,
                    `${b.collectionDate} ${b.collectionTime}`,
                    b.status,
                    new Date(b.createdAt).toLocaleDateString("en-GB"),
                    `$${b.totalPrice?.toFixed(2)}`,
                  ])}
                />
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text variant="headingMd" as="h2">Quick Links</Text>
              <InlineStack gap="300" wrap>
                <Button onClick={() => navigate(`/services?shop=${shop}`)}>Services &amp; Add-ons</Button>
                <Button onClick={() => navigate(`/timeslots?shop=${shop}`)}>Time Slots</Button>
                <Button onClick={() => navigate(`/settings?shop=${shop}`)}>Settings</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
