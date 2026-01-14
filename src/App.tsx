import { NavLink, Route, Routes, useNavigate } from "react-router-dom";
import { AssumptionsFooter } from "./components/AssumptionsFooter";
import { ModelProvider, useModel } from "./model/ModelContext";
import { ExploreModel } from "./routes/ExploreModel";
import { GuidedStory } from "./routes/GuidedStory";
import { Methodology } from "./routes/Methodology";
import { Sa3Map } from "./routes/Sa3Map";
import { Sa3Admin } from "./routes/Sa3Admin";

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
            <NavLink to="/sa3">SA3 Map</NavLink>
            <NavLink to="/sa3-admin">SA3 Admin</NavLink>
            <NavLink to="/methodology">Methodology</NavLink>
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
          <Routes>
            <Route path="/" element={<GuidedStory />} />
            <Route path="/explore" element={<ExploreModel />} />
            <Route path="/sa3" element={<Sa3Map />} />
            <Route path="/sa3-admin" element={<Sa3Admin />} />
            <Route path="/methodology" element={<Methodology />} />
          </Routes>
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


