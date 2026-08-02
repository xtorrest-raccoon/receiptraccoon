"use client";

import { useEffect, useState } from "react";
import { countryName } from "@rr/shared";
import { color, fontSize, fontWeight, radius } from "@rr/ui-tokens";
import type { BillingAddress } from "../lib/data";
import { useBillingAddress, useSetBillingAddress } from "../lib/queries";

/**
 * Every current ISO 3166-1 alpha-2 country code -- Intl.supportedValuesOf("region")
 * would avoid hand-maintaining this, but it throws "Invalid key: region" on
 * this project's Node runtime (not just a TypeScript typing gap -- the ICU
 * build here genuinely doesn't support that key), so a static list it is.
 * Display names still come from countryName()/Intl.DisplayNames, not
 * hand-rolled here -- only the code list itself is static.
 */
const ISO_COUNTRY_CODES = [
  "AF","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BH","BD","BB","BY","BE","BZ","BJ","BT",
  "BO","BA","BW","BR","BN","BG","BF","BI","CV","KH","CM","CA","CF","TD","CL","CN","CO","KM","CG","CD",
  "CR","CI","HR","CU","CY","CZ","DK","DJ","DM","DO","EC","EG","SV","GQ","ER","EE","SZ","ET","FJ","FI",
  "FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU","IS","IN","ID","IR","IQ",
  "IE","IL","IT","JM","JP","JO","KZ","KE","KI","KP","KR","KW","KG","LA","LV","LB","LS","LR","LY","LI",
  "LT","LU","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","FM","MD","MC","MN","ME","MA","MZ","MM",
  "NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM","PK","PW","PA","PG","PY","PE","PH","PL","PT",
  "QA","RO","RU","RW","KN","LC","VC","WS","SM","ST","SA","SN","RS","SC","SL","SG","SK","SI","SB","SO",
  "ZA","SS","ES","LK","SD","SR","SE","CH","SY","TW","TJ","TZ","TH","TL","TG","TO","TT","TN","TR","TM",
  "TV","UG","UA","AE","GB","US","UY","UZ","VU","VA","VE","VN","YE","ZM","ZW",
];

const COUNTRIES: { code: string; name: string }[] = ISO_COUNTRY_CODES.map((code) => ({ code, name: countryName(code) })).sort((a, b) =>
  a.name.localeCompare(b.name),
);

const EMPTY: BillingAddress = {
  legalName: null,
  addressLine1: null,
  addressLine2: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  taxId: null,
  billingEmail: null,
};

const inputStyle = {
  width: "100%",
  border: `1px solid ${color.borderStrong}`,
  borderRadius: radius.sm,
  padding: "8px 10px",
  fontSize: fontSize.small + 0.5,
  background: color.surface,
  color: color.text,
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: fontSize.tiny + 0.5, fontWeight: fontWeight.semibold, color: color.textFaint, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

/**
 * Legal name, address, tax ID, and billing email -- everything Stripe's own
 * invoice PDFs need to look like a proper business invoice (see
 * 0022_billing_address.sql). Held as a local draft, committed on Save
 * rather than per-field, since a half-entered address synced to Stripe
 * mid-typing would be more confusing than useful.
 */
export function BillingAddressForm() {
  const { data: saved } = useBillingAddress();
  const setBillingAddress = useSetBillingAddress();
  const [draft, setDraft] = useState<BillingAddress>(EMPTY);
  const [saveNotice, setSaveNotice] = useState(false);

  useEffect(() => {
    if (saved) setDraft(saved);
  }, [saved]);

  if (!saved) return null;

  const set = <K extends keyof BillingAddress>(key: K, value: string) => setDraft((d) => ({ ...d, [key]: value === "" ? null : value }));

  const canSave = draft.legalName && draft.addressLine1 && draft.city && draft.postalCode && draft.country;

  const save = () => {
    setBillingAddress.mutate(draft, {
      onSuccess: () => {
        setSaveNotice(true);
        setTimeout(() => setSaveNotice(false), 3000);
      },
    });
  };

  return (
    <div style={{ background: color.surface, border: `1px solid ${color.border}`, borderRadius: radius["2xl"], padding: 20, marginTop: 16 }}>
      <div style={{ fontSize: fontSize.base, fontWeight: fontWeight.bold, marginBottom: 4 }}>Customer billing address</div>
      <div style={{ fontSize: fontSize.small, color: color.textMuted, marginBottom: 16 }}>
        Shows up on every invoice Stripe generates for this workspace.
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Legal / company name *">
            <input value={draft.legalName ?? ""} onChange={(e) => set("legalName", e.target.value)} style={inputStyle} placeholder="Acme Consulting Ltd." />
          </Field>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Address line 1 *">
            <input value={draft.addressLine1 ?? ""} onChange={(e) => set("addressLine1", e.target.value)} style={inputStyle} placeholder="123 Main Street" />
          </Field>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <Field label="Address line 2">
            <input value={draft.addressLine2 ?? ""} onChange={(e) => set("addressLine2", e.target.value)} style={inputStyle} placeholder="Suite 400" />
          </Field>
        </div>

        <Field label="City *">
          <input value={draft.city ?? ""} onChange={(e) => set("city", e.target.value)} style={inputStyle} />
        </Field>

        <Field label="State / Province">
          <input value={draft.state ?? ""} onChange={(e) => set("state", e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Postal code *">
          <input value={draft.postalCode ?? ""} onChange={(e) => set("postalCode", e.target.value)} style={inputStyle} />
        </Field>

        <Field label="Country *">
          <select value={draft.country ?? ""} onChange={(e) => set("country", e.target.value)} style={inputStyle}>
            <option value="">Select a country</option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Tax / VAT ID">
          <input value={draft.taxId ?? ""} onChange={(e) => set("taxId", e.target.value)} style={inputStyle} placeholder="e.g. FR12345678901" />
        </Field>

        <Field label="Billing email">
          <input
            type="email"
            value={draft.billingEmail ?? ""}
            onChange={(e) => set("billingEmail", e.target.value)}
            style={inputStyle}
            placeholder="accounts@company.com"
          />
        </Field>
      </div>

      <div style={{ fontSize: fontSize.micro + 0.5, color: color.textFaint, marginTop: 10, lineHeight: 1.4 }}>* Required for invoices to generate correctly.</div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 14 }}>
        <button
          type="button"
          onClick={save}
          disabled={!canSave || setBillingAddress.isPending}
          style={{
            padding: "9px 16px",
            borderRadius: radius.md,
            background: color.brand,
            color: color.surface,
            fontWeight: fontWeight.bold,
            fontSize: fontSize.body,
            border: "none",
            cursor: canSave ? "pointer" : "not-allowed",
            opacity: canSave && !setBillingAddress.isPending ? 1 : 0.6,
          }}
        >
          {setBillingAddress.isPending ? "Saving…" : "Save"}
        </button>
        {saveNotice ? <span style={{ fontSize: fontSize.small, color: color.brand, fontWeight: fontWeight.semibold }}>Saved</span> : null}
      </div>

      {setBillingAddress.isError ? (
        <div style={{ fontSize: fontSize.small, color: color.up, marginTop: 10 }}>
          {setBillingAddress.error instanceof Error ? setBillingAddress.error.message : "Couldn't save the billing address."}
        </div>
      ) : null}
    </div>
  );
}
