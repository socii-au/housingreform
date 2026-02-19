import { Suspense, lazy, useState, useCallback, useEffect, useRef } from "react";
import { NavLink, Link, Route, Routes, useNavigate, useLocation } from "react-router-dom";
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

function MobileDrawer({
  open,
  onClose,
  onReset,
}: {
  open: boolean;
  onClose: () => void;
  onReset: () => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);
  const location = useLocation();

  useEffect(() => {
    if (open) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  useEffect(() => {
    if (open && drawerRef.current) {
      const firstLink = drawerRef.current.querySelector("a, button") as HTMLElement | null;
      firstLink?.focus();
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="drawerBackdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="drawerPanel"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
      >
        <div className="drawerHeader">
          <h2 className="h3" style={{ margin: 0 }}>Menu</h2>
          <button
            type="button"
            className="drawerClose"
            onClick={onClose}
            aria-label="Close menu"
          >
            ✕
          </button>
        </div>
        <nav className="drawerNav" aria-label="Primary">
          <NavLink to="/story">Guided Story</NavLink>
          <NavLink to="/" end>Explore the Model</NavLink>
          <NavLink to="/methodology">Methodology</NavLink>
          <NavLink to="/docs">Docs</NavLink>
          <button type="button" onClick={onReset}>
            ↺ Reset to defaults
          </button>
        </nav>
      </div>
    </>
  );
}

function Shell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { resetToDefaults } = useModel();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const handleReset = useCallback(() => {
    resetToDefaults();
    navigate("/");
    setDrawerOpen(false);
  }, [resetToDefaults, navigate]);

  return (
    <div className="appShell">
      <a
        href="https://socii.au"
        target="_blank"
        rel="noopener noreferrer"
        className="sociiBanner"
      >
        A Free Educational Civics Tool by SOCii
      </a>
      <header className="topBar">
        <div className="container topBarInner">
          <Link
            to="/"
            className="brand"
            aria-label="AIM-HR — Australian Independent Model for Housing Reform (go to Explore the Model)"
          >
            <img
              src="/favicon.svg"
              alt=""
              className="brandMark"
              width={92}
              height={73}
              aria-hidden="true"
            />
            <div>
              <div className="brandTitle">AIM-HR</div>
              <div className="muted" style={{ fontSize: 11 }}>
                Australian Independent Model for Housing Reform
              </div>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="nav" aria-label="Primary">
            <NavLink to="/story">Guided Story</NavLink>
            <NavLink to="/" end>Explore the Model</NavLink>
            <NavLink to="/methodology">Methodology</NavLink>
            <NavLink to="/docs">Docs</NavLink>
            <button
              type="button"
              onClick={handleReset}
            >
              Reset
            </button>
          </nav>

          {/* Mobile hamburger */}
          <button
            type="button"
            className="hamburgerBtn"
            onClick={() => setDrawerOpen((v) => !v)}
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
          >
            <span className={`hamburgerIcon ${drawerOpen ? "open" : ""}`} aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </header>

      <MobileDrawer open={drawerOpen} onClose={closeDrawer} onReset={handleReset} />

      {location.pathname !== "/story" ? (
        <div className="storyBanner">
          <Link to="/story">
            New here? Learn the theory behind the model first in the <strong>Guided Story</strong> →
          </Link>
        </div>
      ) : null}

      <main id="main" className="main">
        <div className="container">
          <p className="buildNotice" aria-live="polite">
            Last updated on{" "}
            {typeof __BUILD_TIME__ !== "undefined"
              ? new Date(__BUILD_TIME__).toLocaleDateString("en-AU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </p>
          <Suspense fallback={<div className="card" style={{ padding: 20, textAlign: "center" }}>Loading…</div>}>
            <Routes>
              <Route path="/" element={<ExploreModel />} />
              <Route path="/story" element={<GuidedStory />} />
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
