import { LegalPageLayout, LegalSection } from "../../components/LegalPageLayout";

export default function TermsPage() {
  return (
    <LegalPageLayout title="Terms of Service" updated="September 5, 2026">
      <p>
        These terms cover your use of Claimeo Pro's web and mobile apps. By creating a workspace, accepting an
        invite to one, or using the mobile app, you agree to them.
      </p>

      <LegalSection heading="The service">
        <p>
          Claimeo Pro lets a company track employee expenses: scanning receipts, logging mileage, routing them
          through an approval workflow, and reporting on spend. The mobile app is a companion to the web app — new
          accounts are created on the web, and the mobile app is for signing in, capturing receipts, and logging
          trips against an account your company has already set up.
        </p>
      </LegalSection>

      <LegalSection heading="Accounts">
        <p>
          A workspace is created by whoever sets your company up on Claimeo Pro; everyone else joins by invite
          from a workspace admin. You're responsible for keeping your own login credentials confidential, and for
          anything that happens under your account. If a System Admin leaves the company or loses access, workspace
          admins can promote another team member to take over — see the in-app Setup page.
        </p>
      </LegalSection>

      <LegalSection heading="Subscriptions and billing">
        <p>
          A workspace's subscription is set up and managed entirely on the web app — new workspaces get a free trial
          period, after which continued use requires an active paid plan, billed and processed by our payment
          provider (Stripe). Whoever your company designates as billing admin can view invoices, update payment/
          billing details, and cancel the subscription from the web app's Payment page.
        </p>
        <p>The mobile app itself is free — it doesn't sell anything and has no purchase flow of its own.</p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Use Claimeo Pro for legitimate business expense tracking. Don't use it to submit fraudulent receipts or
          mileage, attempt to access another company's workspace, interfere with the service, or reverse-engineer any
          part of it.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          Receipts, mileage records, and other data you or your company submit remain yours. We only use it to
          provide the service to you and your workspace, as described in our{" "}
          <a href="/privacy" style={{ color: "inherit" }}>
            Privacy Policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimers">
        <p>
          Claimeo Pro is provided "as is." Receipt data is extracted automatically and can occasionally be wrong —
          always confirm important figures before relying on them for reimbursement or tax purposes. We don't
          guarantee the service will be uninterrupted or error-free.
        </p>
      </LegalSection>

      <LegalSection heading="Limitation of liability">
        <p>
          To the fullest extent the law allows, Claimeo Pro isn't liable for indirect, incidental, or consequential
          damages arising from your use of the service, including errors in extracted receipt data or mileage
          calculations.
        </p>
      </LegalSection>

      <LegalSection heading="Termination">
        <p>
          A workspace owner or admin can delete their company's workspace at any time from the web app's Setup page.
          We may suspend or terminate access for a violation of these terms.
        </p>
      </LegalSection>

      <LegalSection heading="Changes to these terms">
        <p>
          If we make a material change, we'll update the date at the top of this page and notify workspace admins by
          email.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these terms? Email{" "}
          <a href="mailto:contact@receiptraccoon.io" style={{ color: "inherit" }}>
            contact@receiptraccoon.io
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
