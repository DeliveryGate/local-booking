import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, Banner, Button, Text, BlockStack, InlineStack,
  Badge, DataTable, Spinner, Box, Pagination, Select
} from "@shopify/polaris";

const STATUS_OPTIONS = [
  { label: "All", value: "" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const statusTone = { pending: "warning", confirmed: "info", completed: "success", cancelled: "critical" };

export default function Bookings() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";

  const [bookings, setBookings] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [plan, setPlan] = useState("free");
  const [monthlyCount, setMonthlyCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");

  const load = (p = 1, status = statusFilter) => {
    setLoading(true);
    const qs = new URLSearchParams({ shop, page: p, ...(status ? { status } : {}) });
    fetch(`/api/bookings?${qs}`).then(r => r.json()).then(data => {
      setBookings(data.bookings || []);
      setTotal(data.total || 0);
      setPages(data.pages || 1);
      setPlan(data.plan || "free");
      setMonthlyCount(data.monthlyCount || 0);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(1); }, [shop]);

  const handleStatusChange = (val) => {
    setStatusFilter(val);
    setPage(1);
    load(1, val);
  };

  return (
    <Page
      title="Bookings"
      backAction={{ content: "Dashboard", onAction: () => navigate(`/?shop=${shop}`) }}
    >
      <Layout>
        {plan === "free" && (
          <Layout.Section>
            <Banner title="Free plan: up to 20 bookings/month" tone="info" action={{ content: "Upgrade", onAction: () => navigate(`/settings?shop=${shop}`) }}>
              {monthlyCount} of 20 bookings used this month. Upgrade to Starter for unlimited bookings.
            </Banner>
          </Layout.Section>
        )}

        {!["pro", "enterprise"].includes(plan) && (
          <Layout.Section>
            <Banner title="Booking calendar available on Pro" tone="info" action={{ content: "Upgrade to Pro", onAction: () => navigate(`/settings?shop=${shop}`) }}>
              Pro and Enterprise plans include a full booking calendar view, capacity limits, and confirmation emails.
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text variant="headingMd" as="h2">All Bookings ({total})</Text>
                <Box minWidth="160px">
                  <Select label="" labelHidden options={STATUS_OPTIONS} value={statusFilter} onChange={handleStatusChange} />
                </Box>
              </InlineStack>

              {loading ? (
                <Box padding="800"><InlineStack align="center"><Spinner /></InlineStack></Box>
              ) : bookings.length === 0 ? (
                <Text tone="subdued">No bookings found.</Text>
              ) : (
                <>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text", "numeric"]}
                    headings={["Drop-off", "Collection", "Overnight", "Status", "Created", "Total"]}
                    rows={bookings.map(b => [
                      `${b.dropoffDate} ${b.dropoffTime}`,
                      `${b.collectionDate} ${b.collectionTime}`,
                      b.overnight ? "Yes" : "No",
                      <Badge tone={statusTone[b.status] || undefined}>{b.status}</Badge>,
                      new Date(b.createdAt).toLocaleDateString("en-GB"),
                      `$${b.totalPrice?.toFixed(2)}`,
                    ])}
                  />
                  {pages > 1 && (
                    <InlineStack align="center">
                      <Pagination
                        hasPrevious={page > 1}
                        onPrevious={() => { const p = page - 1; setPage(p); load(p); }}
                        hasNext={page < pages}
                        onNext={() => { const p = page + 1; setPage(p); load(p); }}
                        label={`Page ${page} of ${pages}`}
                      />
                    </InlineStack>
                  )}
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
