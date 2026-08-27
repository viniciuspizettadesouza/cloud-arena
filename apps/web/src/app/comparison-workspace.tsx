"use client";

import { useRef, useState, type FormEvent } from "react";
import type { ComparisonResult, RankedCandidate } from "../comparison-types";
import { workloadFromForm, type FormErrors } from "../form";

const PROVIDERS = { aws: "AWS", azure: "Microsoft Azure", gcp: "Google Cloud" } as const;
const LABELS: Record<string, string> = {
  monthlyActiveUsers: "Monthly active users",
  requestsPerMonth: "Requests per month",
  averageRequestsPerUserPerDay: "Average requests / user / day",
  peakRequestsPerSecond: "Peak requests / second",
  averageResponseKB: "Average response size (KB)",
  databaseStorageGB: "Database storage (GB)",
  databaseReadWriteProfile: "Database read/write profile",
  objectStorageGB: "Object storage (GB)",
  monthlyEgressGB: "Monthly public egress (GB)",
  monthlyBudgetUSD: "Monthly budget (USD)",
};

const title = (value: string) =>
  value.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
const money = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);

function ErrorText({ name, errors }: { name: string; errors: FormErrors }) {
  return errors[name] === undefined ? null : (
    <span className="field-error" id={`${name}-error`} role="alert">
      {errors[name]}
    </span>
  );
}

function NumberField({
  name,
  label,
  errors,
  ...props
}: {
  name: string;
  label: string;
  errors: FormErrors;
  defaultValue?: number;
  min?: number;
  max?: number;
  step?: number | "any";
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <input
        aria-describedby={errors[name] ? `${name}-error` : undefined}
        aria-invalid={errors[name] ? true : undefined}
        name={name}
        type="number"
        {...props}
      />
      <ErrorText name={name} errors={errors} />
    </label>
  );
}

function SelectField({
  name,
  label,
  defaultValue,
  options,
  errors,
}: {
  name: string;
  label: string;
  defaultValue: string;
  options: Array<[string, string]>;
  errors: FormErrors;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select name={name} defaultValue={defaultValue}>
        {options.map(([value, text]) => (
          <option key={value} value={value}>
            {text}
          </option>
        ))}
      </select>
      <ErrorText name={name} errors={errors} />
    </label>
  );
}

function Pill({ status }: { status: string }) {
  return <span className={`pill pill-${status}`}>{title(status)}</span>;
}

function Architecture({ item }: { item: RankedCandidate }) {
  const nodes = [
    ...item.candidate.graph.externalNodes,
    ...item.candidate.components.map(({ id, name }) => ({ id, name })),
  ];
  const nameFor = (id: string) => nodes.find((node) => node.id === id)?.name ?? id;
  return (
    <div className="architecture" aria-label={`${PROVIDERS[item.candidate.provider]} architecture`}>
      {item.candidate.graph.edges.map((edge, index) => (
        <div className="architecture-edge" key={`${edge.from}-${edge.to}-${index}`}>
          <span>{nameFor(edge.from)}</span>
          <span aria-hidden="true">→</span>
          <span>{nameFor(edge.to)}</span>
          <small>{title(edge.relationship)}</small>
        </div>
      ))}
    </div>
  );
}

function CandidateDetails({ item }: { item: RankedCandidate }) {
  const estimate = item.costEstimate;
  return (
    <div className="candidate-details">
      <section>
        <h4>Cost breakdown</h4>
        {estimate.lineItems.length === 0 ? (
          <p className="muted">No priced line items are available.</p>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Quantity</th>
                  <th>Monthly</th>
                  <th>Origin</th>
                </tr>
              </thead>
              <tbody>
                {estimate.lineItems.map((line) => (
                  <tr key={line.id}>
                    <td>
                      {line.description}
                      <small>{line.formula}</small>
                    </td>
                    <td>
                      {line.quantity.toLocaleString()} {line.unit}
                    </td>
                    <td>{money(line.monthlyCostUSD)}</td>
                    <td>
                      {line.pricing.map((price) => (
                        <details key={price.pricingRecordId}>
                          <summary>{price.serviceName}</summary>
                          <small>
                            {price.skuName ?? price.skuId} · {price.region} · {price.unitPriceUSD}{" "}
                            USD/{price.unit}
                            <br />
                            Source {price.sourcePriceId}, retrieved{" "}
                            {new Date(price.retrievedAt).toLocaleString()}
                          </small>
                        </details>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {estimate.gaps.length > 0 && (
          <div className="notice warning">
            <strong>Pricing gaps</strong>
            <ul>
              {estimate.gaps.map((gap) => (
                <li key={gap.category}>
                  {title(gap.category)}: {gap.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="split-list">
          <div>
            <strong>Included</strong>
            <ul>
              {estimate.includedItems.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
          <div>
            <strong>Excluded</strong>
            <ul>
              {estimate.excludedItems.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      <section>
        <h4>Score dimensions</h4>
        <div className="dimensions">
          {item.score.dimensions.map((dimension) => (
            <details key={dimension.id}>
              <summary>
                <span>{title(dimension.id)}</span>
                <strong>{dimension.rawScore.toFixed(1)} / 100</strong>
              </summary>
              <p>
                {title(dimension.sourceType)} · weight {(dimension.weight * 100).toFixed(0)}% ·
                confidence {(dimension.confidence * 100).toFixed(0)}%
              </p>
              <ul>
                {dimension.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      </section>
      <section>
        <h4>Architecture</h4>
        <Architecture item={item} />
        <p className="muted">
          {item.candidate.regionSelection.rationale} No geographic-distance latency claim is made.
        </p>
      </section>
    </div>
  );
}

function CandidateCard({ item, recommended }: { item: RankedCandidate; recommended: boolean }) {
  const estimate = item.costEstimate;
  return (
    <article
      className={`provider-card provider-${item.candidate.provider} ${recommended ? "recommended" : ""}`}
    >
      <div className="card-topline">
        <span>{item.candidate.provider.toUpperCase()}</span>
        <span>#{item.rank}</span>
      </div>
      <h3>{PROVIDERS[item.candidate.provider]}</h3>
      <p className="cost">
        {estimate.status === "available" ? money(estimate.monthlyCostUSD) : "Cost unavailable"}
        {estimate.status === "available" && <small>/ month, public list price</small>}
      </p>
      <div className="pills">
        <Pill status={estimate.status} />
        <Pill status={item.constraints.status} />
      </div>
      <dl className="summary-list">
        <div>
          <dt>Score</dt>
          <dd>
            {item.score.totalScore.toFixed(1)} · {title(item.score.classification)}
          </dd>
        </div>
        <div>
          <dt>Region</dt>
          <dd>
            {item.candidate.region.name} ({item.candidate.region.code})
          </dd>
        </div>
        <div>
          <dt>Pattern</dt>
          <dd>{title(item.candidate.patternId)}</dd>
        </div>
      </dl>
      <div className="service-list" aria-label="Services">
        {item.candidate.components.map((component) => (
          <span key={component.id}>
            {component.serviceName}
            <small>
              {component.configurationName} · ×{component.quantity}
            </small>
          </span>
        ))}
      </div>
      {item.constraints.violations.length > 0 && (
        <div className="notice danger">
          <strong>Constraint violation</strong>
          {item.constraints.violations.map((violation) => (
            <p key={violation.constraint}>
              Expected {violation.expected}; actual {violation.actual}.
            </p>
          ))}
        </div>
      )}
      <details className="card-disclosure">
        <summary>Inspect costs, scores &amp; architecture</summary>
        <CandidateDetails item={item} />
      </details>
    </article>
  );
}

function Results({ result }: { result: ComparisonResult }) {
  const recommendation = result.recommendation;
  return (
    <section className="results" aria-labelledby="results-title">
      <div className="section-heading">
        <p className="kicker">Your comparison</p>
        <h2 id="results-title">Three clouds, one inspectable decision</h2>
      </div>
      <div
        className={`recommendation ${recommendation.status === "unavailable" ? "recommendation-unavailable" : ""}`}
      >
        <div>
          <span className="recommendation-label">Recommendation</span>
          <h3>
            {recommendation.status === "available"
              ? PROVIDERS[recommendation.provider]
              : "No recommendation yet"}
          </h3>
        </div>
        <div>
          {recommendation.status === "available" ? (
            <>
              <ul>
                {recommendation.reasons.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
              {recommendation.tie && (
                <p className="muted">A documented stable-ID tie-break was applied.</p>
              )}
            </>
          ) : (
            <p>{recommendation.reason}</p>
          )}
        </div>
      </div>
      <section className="comparison-table" aria-labelledby="comparison-table-title">
        <h3 id="comparison-table-title">Side-by-side summary</h3>
        <div className="table-scroll">
          <table>
            <caption>Provider cost, score, region, pattern, and constraint comparison</caption>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Monthly cost</th>
                <th>Score</th>
                <th>Region</th>
                <th>Pattern</th>
                <th>Constraint</th>
              </tr>
            </thead>
            <tbody>
              {result.candidates.map((item) => (
                <tr key={item.candidate.id}>
                  <th>{PROVIDERS[item.candidate.provider]}</th>
                  <td>
                    {item.costEstimate.status === "available"
                      ? money(item.costEstimate.monthlyCostUSD)
                      : "Unavailable"}
                  </td>
                  <td>{item.score.totalScore.toFixed(1)}</td>
                  <td>{item.candidate.region.name}</td>
                  <td>{title(item.candidate.patternId)}</td>
                  <td>{title(item.constraints.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <div className="provider-grid">
        {result.candidates.map((item) => (
          <CandidateCard
            key={item.candidate.id}
            item={item}
            recommended={
              recommendation.status === "available" &&
              recommendation.candidateId === item.candidate.id
            }
          />
        ))}
      </div>
      <div className="explanation-grid">
        <section className="panel">
          <p className="kicker">Decision context</p>
          <h3>Trade-offs &amp; caveats</h3>
          {recommendation.status === "available" &&
            recommendation.runnerUpTradeOffs.map((tradeoff) => (
              <div className="tradeoff" key={tradeoff.candidateId}>
                <strong>{PROVIDERS[tradeoff.provider]}</strong>
                <ul>
                  {tradeoff.reasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
            ))}
          {recommendation.status === "available" && recommendation.caveats.length > 0 && (
            <details>
              <summary>Recommendation caveats ({recommendation.caveats.length})</summary>
              <ul>
                {recommendation.caveats.map((caveat) => (
                  <li key={caveat}>{caveat}</li>
                ))}
              </ul>
            </details>
          )}
        </section>
        <section className="panel" id="confidence">
          <p className="kicker">Uncertainty</p>
          <h3>
            {title(result.confidenceLabel)} confidence · {(result.confidence * 100).toFixed(0)}%
          </h3>
          <div
            className="meter"
            role="meter"
            aria-label="Comparison confidence"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(result.confidence * 100)}
          >
            <span style={{ width: `${result.confidence * 100}%` }} />
          </div>
          <h4>Missing information</h4>
          {result.missingInformation.length === 0 ? (
            <p className="muted">No missing inputs were identified.</p>
          ) : (
            <ul>
              {result.missingInformation.map((item) => (
                <li key={item.field}>
                  <Pill status={item.impact} /> {item.reason}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <section className="panel assumptions" id="assumptions">
        <div>
          <p className="kicker">How inputs were completed</p>
          <h3>Assumptions &amp; provenance</h3>
          <p className="muted">
            Structured normalization facts from {result.versions.assumptions}.
          </p>
        </div>
        <div className="assumption-list">
          {result.assumptions.map((assumption) => (
            <details key={assumption.id}>
              <summary>
                <span>{LABELS[assumption.field] ?? title(assumption.field)}</span>
                <Pill status="assumed" />
              </summary>
              <p>{assumption.description}</p>
              <code>{String(assumption.value)}</code>
            </details>
          ))}
          {result.normalizedWorkload.provenance.map((item) => (
            <details key={item.field}>
              <summary>
                <span>{LABELS[item.field] ?? title(item.field)}</span>
                <Pill status={item.source} />
              </summary>
              <p>{item.description}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="panel pricing-notices" aria-labelledby="pricing-notices-title">
        <div>
          <p className="kicker">Pricing notices</p>
          <h3 id="pricing-notices-title">Inspectable public-list estimates</h3>
        </div>
        <div>
          {result.pricingNotices.map((notice) => {
            const snapshot = result.versions.pricingSnapshots.find(
              ({ provider }) => provider === notice.provider,
            );
            return (
              <div key={notice.provider} className="pricing-notice">
                <strong>{notice.providerName}</strong>
                <p>{notice.disclaimer}</p>
                <p className="muted">
                  {snapshot?.status === "active"
                    ? `Snapshot ${snapshot.snapshotId}, retrieved ${new Date(snapshot.retrievedAt).toLocaleString()}.`
                    : "No active pricing snapshot."}
                </p>
                <p>
                  <a href={notice.pricingPageUrl} rel="noreferrer" target="_blank">
                    Official pricing
                  </a>{" "}
                  ·{" "}
                  <a href={notice.calculatorUrl} rel="noreferrer" target="_blank">
                    Official calculator
                  </a>
                </p>
              </div>
            );
          })}
        </div>
      </section>
      <footer className="result-footer">
        <span>Catalog {result.versions.catalog}</span>
        <span>Scoring {result.versions.scoring}</span>
        <span>Cost model {result.versions.costCalculation}</span>
        {result.versions.pricingSnapshots.map((snapshot) => (
          <span key={snapshot.provider}>
            {PROVIDERS[snapshot.provider]} pricing:{" "}
            {snapshot.status === "active"
              ? new Date(snapshot.retrievedAt).toLocaleString()
              : "missing"}
          </span>
        ))}
      </footer>
    </section>
  );
}

export default function ComparisonWorkspace() {
  const [errors, setErrors] = useState<FormErrors>({});
  const [requestError, setRequestError] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<ComparisonResult>();
  const resultsRef = useRef<HTMLDivElement>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestError("");
    const parsed = workloadFromForm(new FormData(event.currentTarget));
    if (!parsed.success) {
      setErrors(parsed.errors);
      return;
    }
    setErrors({});
    setPending(true);
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const body = (await response.json()) as
        | ComparisonResult
        | {
            error?: {
              message?: string;
              issues?: Array<{ path: Array<string | number>; message: string }>;
            };
          };
      if (!response.ok) {
        if ("error" in body && body.error?.issues)
          setErrors(
            Object.fromEntries(
              body.error.issues.map((issue) => [String(issue.path.at(-1)), issue.message]),
            ),
          );
        throw new Error("error" in body ? body.error?.message : undefined);
      }
      setResult(body as ComparisonResult);
      requestAnimationFrame(() =>
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    } catch (error) {
      setRequestError(
        error instanceof Error && error.message
          ? error.message
          : "The comparison could not be completed. Try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <section className="hero">
        <nav>
          <a className="brand" href="#top">
            <span>CA</span> Cloud Arena
          </a>
          <a href="#compare">Build comparison ↓</a>
        </nav>
        <div className="hero-copy" id="top">
          <p className="eyebrow">Multi-cloud, without the guesswork</p>
          <h1>
            Find your cloud.
            <br />
            <em>See the evidence.</em>
          </h1>
          <p>
            Compare functionally equivalent AWS, Azure, and Google Cloud architectures using
            deterministic scoring, traceable public prices, and visible uncertainty.
          </p>
        </div>
        <div className="hero-proof">
          <span>
            01
            <br />
            <small>One neutral workload</small>
          </span>
          <span>
            03
            <br />
            <small>Comparable providers</small>
          </span>
          <span>
            100%
            <br />
            <small>Inspectable reasoning</small>
          </span>
        </div>
      </section>
      <main id="compare">
        <section className="form-section">
          <div className="section-heading">
            <p className="kicker">Start with what you know</p>
            <h2>Describe your workload</h2>
            <p>
              Quick Mode takes about a minute. We’ll disclose every assumption used to fill the
              gaps.
            </p>
          </div>
          <form onSubmit={submit} noValidate>
            <input type="hidden" name="applicationType" value="web-api" />
            <fieldset>
              <legend>
                <span>01</span> Quick Mode <small>Required</small>
              </legend>
              <div className="form-grid">
                <label className="field">
                  <span>Application</span>
                  <input value="Web API / SaaS" disabled readOnly />
                </label>
                <NumberField
                  name="monthlyActiveUsers"
                  label="Monthly active users"
                  defaultValue={100000}
                  min={1}
                  max={1000000000}
                  step={1}
                  required
                  errors={errors}
                />
                <SelectField
                  name="geography"
                  label="Primary user geography"
                  defaultValue="Europe"
                  options={[
                    ["Europe", "Europe"],
                    ["North America", "North America"],
                    ["South America", "South America"],
                  ]}
                  errors={errors}
                />
                <SelectField
                  name="trafficProfile"
                  label="Traffic pattern"
                  defaultValue="medium"
                  options={[
                    ["low", "Low"],
                    ["medium", "Medium"],
                    ["high", "High"],
                    ["spiky", "Spiky"],
                  ]}
                  errors={errors}
                />
                <SelectField
                  name="availability"
                  label="Availability need"
                  defaultValue="production"
                  options={[
                    ["standard", "Standard"],
                    ["production", "Production"],
                    ["high", "High"],
                    ["mission-critical", "Mission critical"],
                  ]}
                  errors={errors}
                />
                <SelectField
                  name="priority"
                  label="Optimization priority"
                  defaultValue="balanced"
                  options={[
                    ["balanced", "Balanced"],
                    ["cost", "Lowest cost"],
                    ["reliability", "Reliability"],
                    ["low-operations", "Low operations"],
                  ]}
                  errors={errors}
                />
              </div>
            </fieldset>
            <details className="advanced">
              <summary>
                <span>
                  <strong>Advanced Mode</strong>
                  <small>Optional overrides for a more precise comparison</small>
                </span>
                <span aria-hidden="true">＋</span>
              </summary>
              <div className="form-grid advanced-grid">
                <NumberField
                  name="requestsPerMonth"
                  label="Requests per month"
                  min={1}
                  max={1000000000000}
                  step={1}
                  placeholder="Derived"
                  errors={errors}
                />
                <NumberField
                  name="averageRequestsPerUserPerDay"
                  label="Average requests / user / day"
                  min={0.000001}
                  max={1000000}
                  step="any"
                  placeholder="Derived"
                  errors={errors}
                />
                <NumberField
                  name="peakRequestsPerSecond"
                  label="Peak requests / second"
                  min={0}
                  max={100000000}
                  step="any"
                  placeholder="Derived"
                  errors={errors}
                />
                <NumberField
                  name="averageResponseKB"
                  label="Average response size (KB)"
                  min={0.000001}
                  max={10000000}
                  step="any"
                  placeholder="Default"
                  errors={errors}
                />
                <NumberField
                  name="databaseStorageGB"
                  label="Database storage (GB)"
                  min={0}
                  max={100000000}
                  step="any"
                  placeholder="Default"
                  errors={errors}
                />
                <label className="field">
                  <span>Database read/write profile</span>
                  <input name="databaseReadWriteProfile" placeholder="e.g. read-heavy" />
                  <ErrorText name="databaseReadWriteProfile" errors={errors} />
                </label>
                <NumberField
                  name="objectStorageGB"
                  label="Object storage (GB)"
                  min={0}
                  max={1000000000}
                  step="any"
                  placeholder="Default"
                  errors={errors}
                />
                <NumberField
                  name="monthlyEgressGB"
                  label="Monthly public egress (GB)"
                  min={0}
                  max={1000000000}
                  step="any"
                  placeholder="Derived"
                  errors={errors}
                />
                <NumberField
                  name="monthlyBudgetUSD"
                  label="Monthly budget (USD)"
                  min={0.01}
                  max={1000000000}
                  step="any"
                  placeholder="No constraint"
                  errors={errors}
                />
                <SelectField
                  name="managedServicesPreference"
                  label="Managed services preference"
                  defaultValue=""
                  options={[
                    ["", "No override"],
                    ["low", "Low"],
                    ["medium", "Medium"],
                    ["high", "High"],
                  ]}
                  errors={errors}
                />
                <SelectField
                  name="vendorLockInTolerance"
                  label="Vendor lock-in tolerance"
                  defaultValue=""
                  options={[
                    ["", "No override"],
                    ["low", "Low"],
                    ["medium", "Medium"],
                    ["high", "High"],
                  ]}
                  errors={errors}
                />
              </div>
            </details>
            {requestError && (
              <div className="notice danger submit-error" role="alert">
                {requestError}
              </div>
            )}
            <div className="submit-row">
              <p>Public on-demand USD pricing · No performance claims · No hidden AI ranking</p>
              <button type="submit" disabled={pending}>
                {pending ? "Comparing…" : "Compare AWS, Azure & GCP"}
                <span aria-hidden="true">→</span>
              </button>
            </div>
          </form>
        </section>
        <div ref={resultsRef}>{result && <Results result={result} />}</div>
      </main>
    </>
  );
}
