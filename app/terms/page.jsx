
"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Mail,
  ExternalLink,
  AlertTriangle,
  ChevronRight,
} from "lucide-react";

const UPDATED = "2 November 2026";
const EMAIL = "theinsightfact04@gmail.com";
const SITE = "https://zeriy.com";

const OPERATOR = "[INSERT LEGAL NAME OF ZERIY OPERATOR]";
const ADDRESS = "[INSERT PRINCIPAL BUSINESS ADDRESS]";
const GRIEVANCE =
  "[INSERT GRIEVANCE OFFICER NAME/DESIGNATION AND CONTACT DETAILS]";

const sections = [
  [
    "1. Acceptance and operator",
    [
      "These Terms apply to businesses, shops, service providers, and authorised representatives using ZERIY owner tools. By creating or operating a listing, you agree to these Terms and the Business Owner Privacy Policy.",
      `Operator: ${OPERATOR}. Address: ${ADDRESS}. Website: ${SITE}. Support: ${EMAIL}. Complete the placeholders before launch.`,
    ],
  ],
  [
    "2. Eligibility and compliance",
    [
      "Provide accurate business details and maintain registrations, qualifications, permits, licences, and insurance required for your business and services.",
      "The owner verification process has not been finalised. Provide reasonable verification information through a clearly disclosed process if requested. Do not provide false documents or impersonate another business.",
      "You are responsible for ensuring your services are lawful, accurately described, and delivered by appropriately qualified personnel where required.",
    ],
  ],
  [
    "3. Listings, prices, and booking fee",
    [
      "Keep business name, address, hours, service descriptions, prices, and availability accurate and current. The current product decision is that ZERIY sets the fixed booking fee; the fee and total payable amount must be shown to customers before payment.",
      "Do not unilaterally increase a price after a booking is confirmed. A material price change requires customer agreement before it applies. Do not demand undisclosed charges or misrepresent the service.",
    ],
  ],
  [
    "4. Booking requests",
    [
      "You may accept or reject booking requests using owner tools. ZERIY intends to notify customers of both acceptance and rejection.",
      "Once you accept a booking, make reasonable efforts to honour it, maintain accurate availability, and provide the listed service on the confirmed terms.",
      "Repeated unexplained cancellations, failure to honour bookings, misleading listings, or misuse may lead to restrictions or suspension.",
    ],
  ],
  [
    "5. Payments, payouts, and fees",
    [
      "ZERIY intends to use Razorpay for payments and owner payouts, subject to the marketplace/payout product actually enabled. Do not assume payouts are active until configured and verified.",
      "The commission rate and fee schedule have not been decided. ZERIY must not charge a commission or platform fee unless the applicable amount/calculation, when it applies, payout timing, taxes where applicable, and terms are clearly disclosed and agreed before the owner becomes liable for the charge.",
      "Owners must cooperate with payment reconciliation, refunds, chargebacks, and fraud reviews. Payment-provider terms may also apply.",
    ],
  ],
  [
    "6. Owner cancellation and customer refunds",
    [
      "If you cancel a confirmed booking, cannot provide the service, or are unavailable when the customer arrives for a confirmed appointment, the customer is eligible for a full refund of the booking advance.",
      "Notify ZERIY promptly when you cannot honour a booking so the customer can be notified and a refund initiated. Do not ask customers to waive a refund they are entitled to under these Terms or law.",
      "If a customer cancels at least 24 hours before the appointment, the advance is eligible for a full refund. For cancellations less than 24 hours before the appointment, any non-refundability must be clearly disclosed and accepted before payment and comply with law. No separate cancellation fee is part of the current business decision.",
      "If a booking remains unconfirmed beyond the timeout shown in the app, the advance should be automatically queued for refund. The timeout must be configured and disclosed before launch.",
    ],
  ],
  [
    "7. Refund processing",
    [
      "Eligible refunds will be initiated through ZERIY's payment process, using Razorpay where applicable, ordinarily to the original payment method where supported.",
      "Refund credit timing depends on payment method, provider, bank, and other financial institutions. ZERIY does not guarantee a specific credit date. Operational timing must be confirmed before launch.",
      "Cooperate with investigations of duplicate payments, failed bookings, chargebacks, complaints, and refunds. Do not make unauthorised deductions from a customer's refund.",
    ],
  ],
  [
    "8. Customer data and privacy",
    [
      "Use customer information only to fulfil/manage a booking, provide the requested service, communicate about that booking, resolve a legitimate complaint, or comply with law.",
      "Do not sell customer information, use it for unrelated marketing, share it with other businesses, or retain it longer than necessary. Promotional contact requires an appropriate lawful basis and any required consent.",
      "Protect customer data, restrict staff access, and promptly notify ZERIY of suspected unauthorised access or disclosure. Never request or store customers' CVV or UPI PIN.",
    ],
  ],
  [
    "9. Service quality, reviews, and prohibited conduct",
    [
      "Provide services professionally and consistently with the listing, confirmed booking, and applicable law. Cooperate with reasonable support investigations.",
      "Do not create fake listings, submit false information, commit payment fraud, manipulate reviews, harass users, misuse customer data, bypass security controls, or offer services you are not legally permitted to provide.",
      "ZERIY may review reports of fake, abusive, unlawful, or policy-violating reviews. Owners must not threaten, coerce, or improperly incentivise customers to alter genuine reviews.",
    ],
  ],
  [
    "10. Suspension and termination",
    [
      "ZERIY may restrict, suspend, or remove a listing for serious or repeated violations, suspected fraud, safety concerns, legal requirements, inaccurate information, or failure to honour bookings.",
      "Where appropriate, notice and an opportunity to respond may be provided. Immediate action may be taken where reasonably necessary for urgent safety, fraud, security, or legal risks.",
      "Account closure does not cancel outstanding bookings, refunds, payment reconciliation, or records that must be retained under law.",
    ],
  ],
  [
    "11. Platform role, availability, and liability",
    [
      "ZERIY is intended to connect customers with independent providers but may participate in service delivery depending on the arrangement. The responsible provider and role should be made clear for each service.",
      "Temporary interruptions may occur because of maintenance, technical issues, third-party failures, or events outside reasonable control. ZERIY will take reasonable steps to restore service but does not guarantee uninterrupted availability.",
      "You remain responsible for your business operations, personnel, licences, service quality, representations, and legal compliance. Nothing in these Terms excludes liability or rights that cannot lawfully be excluded or limited.",
    ],
  ],
  [
    "12. Complaints, disputes, and changes",
    [
      `Contact ${EMAIL} for owner support, booking disputes, payment reconciliation, or refund issues.`,
      "These Terms are governed by Indian law, subject to mandatory statutory rights and the jurisdiction of competent forums.",
      "Material changes will be communicated through an appropriate channel and the effective date updated. Any applicable owner fees must be disclosed and agreed before they are charged.",
    ],
  ],
];

function PolicyPage({ title, kind, warning, intro, sections }) {
  const router = useRouter();

  const handleBack = () => {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push("/owner/dashboard");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 sm:py-10">
      <div className="mx-auto max-w-4xl">

        {/* Back button */}
        <button
          type="button"
          onClick={handleBack}
          className="group mb-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 hover:shadow-md active:scale-95"
        >
          <ArrowLeft
            size={17}
            className="transition-transform duration-200 group-hover:-translate-x-1"
          />
          Back
        </button>

        {/* Header */}
        <header className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-6 sm:px-9">
            <div className="mb-6 flex items-center justify-between gap-4">
              <Image
                src="/logo.png"
                alt="ZERIY"
                width={130}
                height={44}
                priority
                className="h-10 w-auto object-contain rounded-xl"
              />

              <span className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-bold text-indigo-700">
                <ShieldCheck size={14} />
                {kind}
              </span>
            </div>

            <p className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
              ZERIY · Business Owner
            </p>

            <h1 className="max-w-2xl text-3xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-4xl">
              {title}
            </h1>

            <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <FileText size={15} />
              Last updated: {UPDATED}
            </p>
          </div>

          <div className="bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-5 text-white sm:px-9">
            <p className="text-sm leading-7 text-indigo-50">
              These Terms explain the responsibilities and conditions for
              businesses using ZERIY owner tools.
            </p>
          </div>
        </header>

        {/* Publishing warning */}
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <AlertTriangle
              size={21}
              className="mt-0.5 shrink-0 text-amber-600"
            />

            <div>
              <h2 className="font-bold text-amber-900">
                Before publishing
              </h2>
              <p className="mt-1 text-sm leading-6 text-amber-800">
                {warning}
              </p>
            </div>
          </div>
        </section>

        {/* Introduction */}
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
          <div className="mb-3 flex items-center gap-2 text-indigo-700">
            <FileText size={19} />
            <h2 className="font-bold">Overview</h2>
          </div>

          <p className="text-sm leading-7 text-slate-600 sm:text-base">
            {intro}
          </p>
        </section>

        {/* Contents */}
        <div className="mt-8">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">
              Terms and conditions
            </h2>

            <span className="text-xs font-medium text-slate-400">
              {sections.length} sections
            </span>
          </div>

          <div className="space-y-4">
            {sections.map(([heading, items], index) => (
              <section
                key={heading}
                className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-100 hover:shadow-md sm:p-7"
              >
                <div className="mb-4 flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
                    {String(index + 1).padStart(2, "0")}
                  </span>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-7 text-slate-900 sm:text-lg">
                      {heading}
                    </h3>
                  </div>

                  <ChevronRight
                    size={18}
                    className="mt-1 shrink-0 text-slate-300 transition-all group-hover:translate-x-1 group-hover:text-indigo-500"
                  />
                </div>

                <div className="space-y-3 pl-0 sm:pl-12">
                  {items.map((item, i) => (
                    <p
                      key={i}
                      className="text-sm leading-7 text-slate-600"
                    >
                      {item}
                    </p>
                  ))}
                </div>
              </section>
            ))}
          </div>
        </div>

        {/* Contact */}
        <section className="mt-8 overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-700 to-violet-700 p-6 text-white shadow-lg sm:p-8">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
              <Mail size={22} />
            </div>

            <div className="min-w-0">
              <h2 className="text-lg font-bold">
                Need help with these Terms?
              </h2>

              <p className="mt-2 text-sm leading-6 text-indigo-100">
                Contact our support team for owner assistance, booking
                disputes, payment reconciliation, or refund-related queries.
              </p>

              <a
                href={`mailto:${EMAIL}`}
                className="mt-4 inline-flex max-w-full items-center gap-2 break-all rounded-xl bg-white px-4 py-3 text-sm font-bold text-indigo-700 shadow-sm transition-all hover:-translate-y-0.5 hover:bg-indigo-50 hover:shadow-md active:scale-95"
              >
                <Mail size={16} />
                {EMAIL}
                <ExternalLink size={14} />
              </a>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-8 border-t border-slate-200 py-6 text-center">
          <Image
            src="/logo.png"
            alt="ZERIY"
            width={100}
            height={34}
            className="mx-auto mb-3 h-8 w-auto object-contain opacity-80"
          />

          <p className="text-xs leading-6 text-slate-500">
            © {new Date().getFullYear()} ZERIY. All rights reserved.
          </p>

          <p className="mt-1 text-xs text-slate-400">
            Made Simpler & Much Faster
          </p>

          <a
            href={SITE}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 transition-colors hover:text-indigo-800"
          >
            zeriy.com
            <ExternalLink size={12} />
          </a>
        </footer>
      </div>
    </main>
  );
}

export default function OwnerTermsAndConditions() {
  return (
    <PolicyPage
      title="Business Owner Terms & Conditions"
      kind="Terms"
      warning="Complete operator details, choose and disclose the automatic-refund timeout, settle the owner fee/commission schedule, verify Razorpay payout capabilities, and obtain Indian legal review."
      intro="These Terms govern owner listings, booking handling, payments, customer information, service duties, cancellations, and refunds."
      sections={sections}
    />
  );
}
