import { FOUNDATION_STATUS, HOME_HEADING } from "../content";

export default function HomePage() {
  return (
    <main>
      <p className="eyebrow">Cloud Arena</p>
      <h1>{HOME_HEADING}</h1>
      <p className="lede">
        Build deterministic AWS, Azure, and Google Cloud comparisons with traceable public pricing,
        explicit assumptions, and visible uncertainty.
      </p>
      <p className="status">{FOUNDATION_STATUS}</p>
    </main>
  );
}
