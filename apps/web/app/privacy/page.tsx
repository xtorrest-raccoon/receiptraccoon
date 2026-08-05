import { LegalPageLayout, LegalSection } from "../../components/LegalPageLayout";

export default function PrivacyPage() {
  return (
    <LegalPageLayout title="Privacy Policy" updated="August 3, 2026">
      <p>
        This policy explains what ReceiptRaccoon ("we", "us") collects when you or your company uses our expense
        tracking service — the web app, the mobile app, and everything behind them — and what we do with it.
      </p>

      <LegalSection heading="Information we collect">
        <p>
          <strong>Account information.</strong> Name, email address, and job title, collected when you sign up or
          when a workspace admin invites you.
        </p>
        <p>
          <strong>Receipts and mileage.</strong> Photos of receipts you upload, the data our system extracts from
          them (vendor, date, amounts, tax, category, and the last 4 digits and brand of a payment card if printed on
          the receipt — never a full card number), and any mileage trips you log, including addresses if you use
          automatic distance calculation.
        </p>
        <p>
          <strong>Workspace and billing information.</strong> Your company's workspace name, currency and mileage
          settings, and — for whoever manages billing — the billing address and payment details needed to process a
          subscription (handled directly by our payment processor; we never see or store full card numbers).
        </p>
        <p>
          <strong>Usage information.</strong> Basic technical data (device type, app version, general log data) we
          use to keep the service running and to diagnose problems.
        </p>
      </LegalSection>

      <LegalSection heading="How we use it">
        <p>
          To operate the service: extracting data from your receipts, calculating reimbursements and mileage,
          running approval workflows, sending you email notifications you'd expect (invites, approval reminders,
          password resets), and processing subscription payments.
        </p>
        <p>We don't sell your data, and we don't use your receipts or mileage data to train any AI model.</p>
      </LegalSection>

      <LegalSection heading="Who we share it with">
        <p>We use a small number of service providers to run ReceiptRaccoon, each only for what they need:</p>
        <ul style={{ paddingLeft: 20, display: "flex", flexDirection: "column", gap: 8 }}>
          <li><strong>Supabase</strong> — hosts our database, authentication, and receipt photo storage.</li>
          <li><strong>OpenAI</strong> — reads receipt photos to extract vendor, amounts, and other line items.</li>
          <li><strong>Stripe</strong> — processes subscription payments and stores billing/payment details.</li>
          <li><strong>Resend</strong> — delivers transactional emails (invites, reminders, notifications).</li>
          <li><strong>Google Maps</strong> — calculates driving distance when you enter a trip by start/end address instead of a manual distance.</li>
        </ul>
        <p>
          We also share workspace data with whoever your company's admins have granted approval or refund authority
          over your expenses — that's the whole point of the product, and it's configured inside your workspace's own
          Setup page, not by us.
        </p>
      </LegalSection>

      <LegalSection heading="Data retention">
        <p>
          We keep your data for as long as your workspace's account is active, plus a reasonable period afterward for
          legal, tax, and accounting reasons (expense records are often needed for audits). If your company deletes
          its workspace, associated receipts, mileage records, and files are deleted from our systems within 30 days.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights, and deleting your account">
        <p>
          You can ask to see, correct, or delete the personal data we hold about you at any time. To delete your
          account, email us at{" "}
          <a href="mailto:contact@receiptraccoon.io" style={{ color: "inherit" }}>
            contact@receiptraccoon.io
          </a>{" "}
          from the address on your account — see our <a href="/support" style={{ color: "inherit" }}>Support page</a>{" "}
          for the full process. If you're an EU or UK resident, this also covers your rights under GDPR; if you're a
          California resident, it covers your rights under the CCPA.
        </p>
      </LegalSection>

      <LegalSection heading="Children's privacy">
        <p>ReceiptRaccoon is a workplace tool and isn't directed at, or knowingly used by, anyone under 16.</p>
      </LegalSection>

      <LegalSection heading="Security">
        <p>
          Receipt photos and data are encrypted in transit and at rest. Access within a workspace is governed by the
          roles and approval permissions your company's admins configure — see the Setup page's Profile Definition
          table.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to this policy">
        <p>
          If we make a material change to how we handle your data, we'll update the date at the top of this page and,
          for significant changes, notify workspace admins by email.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about this policy? Email{" "}
          <a href="mailto:contact@receiptraccoon.io" style={{ color: "inherit" }}>
            contact@receiptraccoon.io
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
