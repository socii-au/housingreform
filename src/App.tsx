import { Suspense, lazy } from "react";
import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AssumptionsFooter } from "./components/AssumptionsFooter";
import { ModelProvider, useModel } from "./model/ModelContext";

const GuidedStory = lazy(() =>
  import("./routes/GuidedStory").then((m) => ({ default: m.GuidedStory }))
);
const ExploreModel = lazy(() =>
  import("./routes/ExploreModel").then((m) => ({ default: m.ExploreModel }))
);
const Methodology = lazy(() =>
  import("./routes/Methodology").then((m) => ({ default: m.Methodology }))
);
const Docs = lazy(() =>
  import("./routes/Docs").then((m) => ({ default: m.Docs }))
);

function Shell() {
  const navigate = useNavigate();
  const { resetToDefaults } = useModel();

  return (
    <div className="appShell">
      <header className="topBar">
        <div className="container topBarInner">
          <div className="brand" aria-label="Housing Reform Impact Explorer">
            <div className="brandMark" aria-hidden="true" />
            <div>
              <div className="brandTitle">Housing Reform Impact Explorer</div>
              <div className="muted" style={{ fontSize: 12 }}>
                Scenario explainer (not a forecast)
              </div>
            </div>
          </div>

          <nav className="nav" aria-label="Primary">
            <NavLink to="/" end>
              Guided Story
            </NavLink>
            <NavLink to="/explore">Explore the Model</NavLink>
            <NavLink to="/methodology">Methodology</NavLink>
            <NavLink to="/docs">Docs</NavLink>
            <button
              type="button"
              onClick={() => {
                resetToDefaults();
                navigate("/explore");
              }}
            >
              Reset
            </button>
          </nav>
        </div>
      </header>

      <main id="main" className="main">
        <div className="container">
          <Suspense fallback={<div className="card">Loading…</div>}>
            <Routes>
              <Route path="/" element={<GuidedStory />} />
              <Route path="/explore" element={<ExploreModel />} />
              <Route path="/methodology" element={<Methodology />} />
              <Route path="/docs" element={<Docs />} />
            </Routes>
          </Suspense>
        </div>
      </main>

      <AssumptionsFooter />
    </div>
  );
}

export default function App() {
  return (
    <ModelProvider>
      <Shell />
    </ModelProvider>
  );
}


