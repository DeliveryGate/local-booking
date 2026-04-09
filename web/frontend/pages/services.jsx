import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Page, Layout, Card, TextField, Button, Banner, Toast, Frame,
  Text, BlockStack, InlineStack, Badge, DataTable, Modal, Select, Box, Spinner
} from "@shopify/polaris";

export default function Services() {
  const navigate = useNavigate();
  const shop = new URLSearchParams(window.location.search).get("shop") || "";

  const [services, setServices] = useState([]);
  const [addOns, setAddOns] = useState([]);
  const [plan, setPlan] = useState("free");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Service form
  const [svcModal, setSvcModal] = useState(false);
  const [editSvc, setEditSvc] = useState(null);
  const [svcName, setSvcName] = useState("");
  const [svcPrice, setSvcPrice] = useState("");
  const [svcIcon, setSvcIcon] = useState("🧳");
  const [svcSaving, setSvcSaving] = useState(false);

  // Add-on form
  const [aoModal, setAoModal] = useState(false);
  const [editAo, setEditAo] = useState(null);
  const [aoName, setAoName] = useState("");
  const [aoPrice, setAoPrice] = useState("");
  const [aoPaidAt, setAoPaidAt] = useState("online");
  const [aoSaving, setAoSaving] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([
      fetch(`/api/services?shop=${shop}`).then(r => r.json()),
      fetch(`/api/addons?shop=${shop}`).then(r => r.json()),
      fetch(`/api/billing/status?shop=${shop}`).then(r => r.json()),
    ]).then(([svcs, aos, status]) => {
      setServices(Array.isArray(svcs) ? svcs : []);
      setAddOns(Array.isArray(aos) ? aos : []);
      setPlan(status?.plan || "free");
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [shop]);

  // ── Service CRUD ──
  const openNewSvc = () => {
    setEditSvc(null); setSvcName(""); setSvcPrice(""); setSvcIcon("🧳"); setSvcModal(true);
  };
  const openEditSvc = (s) => {
    setEditSvc(s); setSvcName(s.name); setSvcPrice(String(s.pricePerDay)); setSvcIcon(s.icon || "🧳"); setSvcModal(true);
  };
  const saveSvc = async () => {
    setSvcSaving(true);
    const url = editSvc ? `/api/services/${editSvc.id}?shop=${shop}` : `/api/services?shop=${shop}`;
    const method = editSvc ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: svcName, pricePerDay: parseFloat(svcPrice), icon: svcIcon }) });
    const data = await res.json();
    setSvcSaving(false);
    if (data.upgrade) { setToast("Upgrade to Starter for unlimited services"); setSvcModal(false); return; }
    if (data.error) { setToast(data.error); return; }
    setSvcModal(false); setToast(editSvc ? "Service updated" : "Service created"); load();
  };
  const deleteSvc = async (id) => {
    if (!confirm("Delete this service?")) return;
    await fetch(`/api/services/${id}?shop=${shop}`, { method: "DELETE" });
    setToast("Service deleted"); load();
  };

  // ── Add-on CRUD ──
  const openNewAo = () => {
    setEditAo(null); setAoName(""); setAoPrice(""); setAoPaidAt("online"); setAoModal(true);
  };
  const openEditAo = (a) => {
    setEditAo(a); setAoName(a.name); setAoPrice(String(a.price)); setAoPaidAt(a.paidAt || "online"); setAoModal(true);
  };
  const saveAo = async () => {
    setAoSaving(true);
    const url = editAo ? `/api/addons/${editAo.id}?shop=${shop}` : `/api/addons?shop=${shop}`;
    const method = editAo ? "PUT" : "POST";
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: aoName, price: parseFloat(aoPrice), paidAt: aoPaidAt }) });
    const data = await res.json();
    setAoSaving(false);
    if (data.upgrade) { setToast("Upgrade to Starter for add-ons"); setAoModal(false); return; }
    if (data.error) { setToast(data.error); return; }
    setAoModal(false); setToast(editAo ? "Add-on updated" : "Add-on created"); load();
  };
  const deleteAo = async (id) => {
    if (!confirm("Delete this add-on?")) return;
    await fetch(`/api/addons/${id}?shop=${shop}`, { method: "DELETE" });
    setToast("Add-on deleted"); load();
  };

  if (loading) return (
    <Page title="Services"><Layout><Layout.Section><Card>
      <Box padding="800"><InlineStack align="center"><Spinner size="large" /></InlineStack></Box>
    </Card></Layout.Section></Layout></Page>
  );

  return (
    <Frame>
      <Page
        title="Services &amp; Add-ons"
        backAction={{ content: "Dashboard", onAction: () => navigate(`/?shop=${shop}`) }}
        primaryAction={{ content: "Add service", onAction: openNewSvc }}
        secondaryActions={plan !== "free" ? [{ content: "Add add-on", onAction: openNewAo }] : []}
      >
        <Layout>
          {plan === "free" && (
            <Layout.Section>
              <Banner title="Free plan: 1 service type" tone="info" action={{ content: "Upgrade", onAction: () => navigate(`/settings?shop=${shop}`) }}>
                Upgrade to Starter for unlimited service types and add-ons.
              </Banner>
            </Layout.Section>
          )}

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Service Types</Text>
                  <Button variant="primary" onClick={openNewSvc}>Add service</Button>
                </InlineStack>
                {services.length === 0 ? (
                  <Text tone="subdued">No services yet. Add your first service type (e.g. Small Bag, Large Suitcase, Bike Storage).</Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Icon", "Name", "Price/Day", "Status", "Actions"]}
                    rows={services.map(s => [
                      s.icon,
                      s.name,
                      `$${s.pricePerDay?.toFixed(2)}`,
                      s.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
                      <InlineStack gap="200">
                        <Button variant="plain" onClick={() => openEditSvc(s)}>Edit</Button>
                        <Button variant="plain" tone="critical" onClick={() => deleteSvc(s.id)}>Delete</Button>
                      </InlineStack>,
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <InlineStack align="space-between">
                  <Text variant="headingMd" as="h2">Add-ons</Text>
                  {plan !== "free" && <Button variant="primary" onClick={openNewAo}>Add add-on</Button>}
                </InlineStack>
                {plan === "free" ? (
                  <Text tone="subdued">Add-ons are available on Starter plan and above.</Text>
                ) : addOns.length === 0 ? (
                  <Text tone="subdued">No add-ons yet. Add optional extras customers can select at booking (e.g. Travel Insurance, Priority Collection).</Text>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Name", "Price", "Paid At", "Status", "Actions"]}
                    rows={addOns.map(a => [
                      a.name,
                      `$${a.price?.toFixed(2)}`,
                      a.paidAt === "online" ? "Online" : "At pickup",
                      a.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>,
                      <InlineStack gap="200">
                        <Button variant="plain" onClick={() => openEditAo(a)}>Edit</Button>
                        <Button variant="plain" tone="critical" onClick={() => deleteAo(a.id)}>Delete</Button>
                      </InlineStack>,
                    ])}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        {/* Service Modal */}
        <Modal open={svcModal} onClose={() => setSvcModal(false)} title={editSvc ? "Edit service" : "Add service"}
          primaryAction={{ content: "Save", loading: svcSaving, onAction: saveSvc }}
          secondaryActions={[{ content: "Cancel", onAction: () => setSvcModal(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <TextField label="Service name" value={svcName} onChange={setSvcName} placeholder="e.g. Small Bag, Large Suitcase, Bike" autoComplete="off" />
              <TextField label="Price per day ($)" value={svcPrice} onChange={setSvcPrice} type="number" min="0" step="0.01" autoComplete="off" />
              <TextField label="Icon (emoji)" value={svcIcon} onChange={setSvcIcon} autoComplete="off" helpText="e.g. 🧳 🎒 🚲 📦" />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {/* Add-on Modal */}
        <Modal open={aoModal} onClose={() => setAoModal(false)} title={editAo ? "Edit add-on" : "Add add-on"}
          primaryAction={{ content: "Save", loading: aoSaving, onAction: saveAo }}
          secondaryActions={[{ content: "Cancel", onAction: () => setAoModal(false) }]}
        >
          <Modal.Section>
            <BlockStack gap="300">
              <TextField label="Add-on name" value={aoName} onChange={setAoName} placeholder="e.g. Travel Insurance, Priority Collection" autoComplete="off" />
              <TextField label="Price ($)" value={aoPrice} onChange={setAoPrice} type="number" min="0" step="0.01" autoComplete="off" />
              <Select label="Payment timing"
                options={[{ label: "Charged online at checkout", value: "online" }, { label: "Paid at pickup", value: "pickup" }]}
                value={aoPaidAt} onChange={setAoPaidAt}
              />
            </BlockStack>
          </Modal.Section>
        </Modal>

        {toast && <Toast content={toast} onDismiss={() => setToast(null)} />}
      </Page>
    </Frame>
  );
}
