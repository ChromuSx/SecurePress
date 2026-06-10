import React from "react";
import {
  AbsoluteFill,
  Img,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const COLORS = {
  bgTop: "#07111f",
  bgBottom: "#0b1727",
  panel: "#121a25",
  panel2: "#182333",
  stroke: "rgba(151, 220, 255, 0.18)",
  cyan: "#08e2ff",
  blue: "#0b8cff",
  green: "#27d17f",
  red: "#ef4358",
  amber: "#ffb020",
  text: "#edf8ff",
  muted: "#95abc2",
  ink: "#15202d",
  white: "#ffffff",
};

const FONT =
  '"Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';

const keyAssets = {
  idle: "keys/key-idle.png",
  authenticating: "keys/key-authenticating.png",
  success: "keys/key-success.png",
  error: "keys/key-error.png",
};

type KeyState = keyof typeof keyAssets;

const ShieldIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      d="M24 5 10 10v12c0 10 5.7 17 14 21 8.3-4 14-11 14-21V10L24 5Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.4"
      strokeLinejoin="round"
    />
    <path
      d="M17 25h14m-10 0v-6a3 3 0 0 1 6 0v6m-7 7h8"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const FingerprintIcon: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <svg width={size} height={size} viewBox="0 0 48 48">
    <path
      d="M12 23a12 12 0 0 1 24 0M17 36c2-5 2-10 1.7-14.2A5.4 5.4 0 0 1 24 16a5.4 5.4 0 0 1 5.3 5.8c-.4 7.4-.6 12.3-4.3 18.2M23 42c5.8-7 7-13 7.2-20M15 29c0-2.2-.1-4.3-.2-6.2M35 31c.6-3.2.8-6 .8-8.2M20 10a15.8 15.8 0 0 1 20 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
    />
  </svg>
);

const Background: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = Math.sin(frame / 78) * 18;
  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${COLORS.bgTop}, ${COLORS.bgBottom})`,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 18% 22%, rgba(8,226,255,0.24), transparent 28%), radial-gradient(circle at 80% 30%, rgba(11,140,255,0.22), transparent 32%), radial-gradient(circle at 55% 86%, rgba(39,209,127,0.14), transparent 28%)",
          transform: `translate3d(${drift}px, ${-drift * 0.5}px, 0)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)",
          backgroundSize: "54px 54px",
          maskImage: "linear-gradient(180deg, rgba(0,0,0,0.72), transparent)",
        }}
      />
    </AbsoluteFill>
  );
};

const Badge: React.FC<{ children: React.ReactNode; color?: string }> = ({
  children,
  color = COLORS.cyan,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      height: 42,
      padding: "0 18px",
      borderRadius: 999,
      border: `1px solid ${color}55`,
      background: `${color}18`,
      color,
      fontSize: 18,
      fontWeight: 800,
    }}
  >
    <span
      style={{
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: color,
        boxShadow: `0 0 22px ${color}`,
      }}
    />
    {children}
  </div>
);

const Key: React.FC<{
  state?: KeyState;
  label?: string;
  empty?: boolean;
  glow?: number;
}> = ({ state = "idle", label, empty = false, glow = 0 }) => {
  return (
    <div
      style={{
        width: 92,
        height: 92,
        borderRadius: 18,
        background: empty
          ? "linear-gradient(180deg, #222832, #111720)"
          : "linear-gradient(180deg, #101923, #060a10)",
        border: "1px solid rgba(255,255,255,0.10)",
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 0 ${34 * glow}px ${
          glow > 0 ? COLORS.cyan : "transparent"
        }`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {!empty ? (
        <Img
          src={staticFile(keyAssets[state])}
          style={{ width: 70, height: 70, objectFit: "contain" }}
        />
      ) : null}
      {label ? (
        <div
          style={{
            position: "absolute",
            bottom: 7,
            left: 5,
            right: 5,
            textAlign: "center",
            color: "#d9f7ff",
            fontSize: 9,
            fontWeight: 900,
            textShadow: "0 1px 4px #000",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

const StreamDeck: React.FC<{
  active?: KeyState;
  success?: boolean;
  error?: boolean;
  scale?: number;
}> = ({ active = "idle", success = false, error = false, scale = 1 }) => {
  const states: KeyState[] = [
    active,
    success ? "success" : "idle",
    error ? "error" : "idle",
    "idle",
    "idle",
  ];
  const labels = ["HTTP", "Text", "Script", "Hotkey", "App"];
  return (
    <div
      style={{
        width: 650,
        padding: 34,
        borderRadius: 42,
        background: "linear-gradient(145deg, #303845, #0b0f16 68%)",
        boxShadow:
          "0 44px 96px rgba(0,0,0,0.46), inset 0 2px 0 rgba(255,255,255,0.13)",
        border: "1px solid rgba(255,255,255,0.12)",
        transform: `scale(${scale})`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 92px)",
          gridAutoRows: "92px",
          gap: 20,
          justifyContent: "center",
        }}
      >
        {Array.from({ length: 15 }).map((_, index) => (
          <Key
            key={index}
            state={states[index] ?? "idle"}
            label={index < 5 ? labels[index] : undefined}
            empty={index >= 5}
            glow={index === 0 ? (active === "authenticating" ? 0.8 : active === "success" ? 0.5 : 0) : 0}
          />
        ))}
      </div>
    </div>
  );
};

const HelloPrompt: React.FC<{ progress: number; verified?: boolean }> = ({
  progress,
  verified = false,
}) => {
  const y = interpolate(progress, [0, 1], [28, 0]);
  return (
    <div
      style={{
        width: 430,
        borderRadius: 24,
        background: "rgba(246,250,255,0.96)",
        color: COLORS.ink,
        padding: 28,
        boxShadow: "0 34px 90px rgba(0,0,0,0.38)",
        border: "1px solid rgba(255,255,255,0.8)",
        opacity: progress,
        transform: `translateY(${y}px) scale(${0.95 + progress * 0.05})`,
        fontFamily: FONT,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: verified
              ? "linear-gradient(135deg, #21d37e, #09b86a)"
              : "linear-gradient(135deg, #08e2ff, #0b8cff)",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 16px 34px rgba(11,140,255,0.28)",
          }}
        >
          {verified ? <ShieldIcon size={34} /> : <FingerprintIcon size={36} />}
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 900 }}>
            {verified ? "Verified" : "Windows Hello"}
          </div>
          <div style={{ marginTop: 4, color: "#5b6675", fontSize: 15, fontWeight: 700 }}>
            SecurePress needs your approval
          </div>
        </div>
      </div>
      <div
        style={{
          marginTop: 24,
          height: 54,
          borderRadius: 14,
          background: verified ? "rgba(39,209,127,0.12)" : "rgba(11,140,255,0.10)",
          border: `1px solid ${verified ? "rgba(39,209,127,0.24)" : "rgba(11,140,255,0.20)"}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          fontWeight: 850,
          color: verified ? "#087343" : "#0b5fb5",
        }}
      >
        {verified ? "Action unlocked" : "PIN, face, or fingerprint"}
      </div>
    </div>
  );
};

const PropertyInspectorPanel: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const fields = [
    ["Action Type", "HTTP Request"],
    ["URL", "https://localhost:8080/start"],
    ["Method", "POST"],
    ["Headers", "Stored with DPAPI"],
    ["Authentication", "Require every time"],
  ];

  return (
    <div
      style={{
        width: compact ? 520 : 640,
        borderRadius: 22,
        background: "linear-gradient(180deg, #2d2d2d, #202020)",
        border: "1px solid rgba(255,255,255,0.14)",
        boxShadow: "0 34px 92px rgba(0,0,0,0.34)",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          height: 58,
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "0 22px",
          background: "#181818",
          borderBottom: "1px solid #3b3b3b",
          color: "#e7e7e7",
          fontSize: 18,
          fontWeight: 900,
        }}
      >
        <Img src={staticFile("plugin-icon.png")} style={{ width: 34, height: 34 }} />
        SecurePress Configuration
      </div>
      <div style={{ padding: 24 }}>
        {fields.map(([label, value], index) => (
          <div key={label} style={{ marginBottom: index === fields.length - 1 ? 0 : 16 }}>
            <div
              style={{
                color: "#9d9d9d",
                fontSize: 12,
                textTransform: "uppercase",
                fontWeight: 850,
                marginBottom: 7,
              }}
            >
              {label}
            </div>
            <div
              style={{
                height: 46,
                borderRadius: 8,
                background: index === 3 ? "rgba(8,226,255,0.10)" : "#3a3a3a",
                border: `1px solid ${index === 3 ? "rgba(8,226,255,0.34)" : "#515151"}`,
                color: index === 3 ? COLORS.cyan : "#f1f1f1",
                display: "flex",
                alignItems: "center",
                padding: "0 14px",
                fontSize: 15,
                fontWeight: 750,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const FeatureCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  detail: string;
  color?: string;
}> = ({ icon, title, detail, color = COLORS.cyan }) => (
  <div
    style={{
      width: 300,
      minHeight: 116,
      borderRadius: 18,
      background: "rgba(255,255,255,0.085)",
      border: "1px solid rgba(255,255,255,0.14)",
      padding: 20,
      color: COLORS.text,
      boxShadow: "0 22px 50px rgba(0,0,0,0.18)",
    }}
  >
    <div style={{ color, marginBottom: 12 }}>{icon}</div>
    <div style={{ fontSize: 21, fontWeight: 900 }}>{title}</div>
    <div style={{ marginTop: 7, color: COLORS.muted, fontSize: 15, fontWeight: 650, lineHeight: 1.35 }}>
      {detail}
    </div>
  </div>
);

const HeroText: React.FC<{ title: React.ReactNode; subtitle: string; badge?: string }> = ({
  title,
  subtitle,
  badge = "Windows Hello for Stream Deck",
}) => (
  <div style={{ maxWidth: 760, fontFamily: FONT }}>
    <Badge>{badge}</Badge>
    <div
      style={{
        marginTop: 24,
        fontSize: 82,
        fontWeight: 950,
        lineHeight: 0.98,
        letterSpacing: 0,
        color: COLORS.text,
      }}
    >
      {title}
    </div>
    <div
      style={{
        marginTop: 22,
        fontSize: 29,
        lineHeight: 1.24,
        color: COLORS.muted,
        fontWeight: 680,
      }}
    >
      {subtitle}
    </div>
  </div>
);

const SceneSetup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18, mass: 0.85 } });
  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        fontFamily: FONT,
      }}
    >
      <div
        style={{
          width: 1480,
          height: 790,
          borderRadius: 26,
          overflow: "hidden",
          background: "#242424",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 38px 100px rgba(0,0,0,0.34)",
          opacity: enter,
          transform: `translateY(${(1 - enter) * 24}px)`,
        }}
      >
        <div
          style={{
            height: 60,
            background: "#1b1b1b",
            borderBottom: "1px solid #383838",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 24px",
            color: "#d8d8d8",
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          <span>Stream Deck</span>
          <span style={{ color: "#999" }}>Default Profile</span>
          <span style={{ color: COLORS.cyan }}>SecurePress</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", height: 432 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background:
                "radial-gradient(circle at center, #383838 0%, #292929 46%, #222 100%)",
            }}
          >
            <StreamDeck active="idle" scale={0.82} />
          </div>
          <div
            style={{
              borderLeft: "1px solid #383838",
              padding: 20,
              background: "#2e2e2e",
              color: "#d6d6d6",
            }}
          >
            <div
              style={{
                height: 38,
                borderRadius: 7,
                background: "#202020",
                border: "1px solid #454545",
                color: "#828282",
                display: "flex",
                alignItems: "center",
                paddingLeft: 13,
                fontSize: 13,
                marginBottom: 18,
              }}
            >
              Search actions
            </div>
            <div style={{ fontSize: 13, color: "#a4a4a4", fontWeight: 850 }}>
              SecurePress
            </div>
            {["Secure Action", "Secure Text", "Secure Script"].map((label, index) => (
              <div
                key={label}
                style={{
                  marginTop: 11,
                  height: 48,
                  borderRadius: 8,
                  background: index === 0 ? "#0e7afe" : "#343434",
                  border: `1px solid ${index === 0 ? "#2490ff" : "#4b4b4b"}`,
                  color: "#f4f7fb",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "0 12px",
                  fontSize: 14,
                  fontWeight: 800,
                }}
              >
                <Img src={staticFile("action-icon@2x.png")} style={{ width: 24, height: 24 }} />
                {label}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            height: 298,
            background: "#2d2d2d",
            borderTop: "1px solid #3f3f3f",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "0 34px",
          }}
        >
          <PropertyInspectorPanel compact />
          <div style={{ width: 530, color: "#d8d8d8" }}>
            <div style={{ fontSize: 42, fontWeight: 950, lineHeight: 1.02 }}>
              Lock the risky buttons
            </div>
            <div style={{ marginTop: 16, color: "#9aa8b8", fontSize: 22, fontWeight: 700, lineHeight: 1.3 }}>
              Programs, scripts, HTTP requests and text input wait for biometric approval.
            </div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneAuth: React.FC = () => {
  const frame = useCurrentFrame();
  const promptIn = interpolate(frame, [28, 58], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const verified = frame > 164;
  const keyState: KeyState = frame < 42 ? "idle" : verified ? "success" : "authenticating";
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
      <div style={{ display: "flex", alignItems: "center", gap: 84 }}>
        <StreamDeck active={keyState} scale={1.02} success={verified} />
        <div>
          <HelloPrompt progress={promptIn} verified={verified} />
          <div
            style={{
              marginTop: 24,
              display: "flex",
              gap: 12,
              opacity: promptIn,
            }}
          >
            <Badge color={COLORS.green}>Prompt stays on top</Badge>
            <Badge color={COLORS.cyan}>Focus is restored</Badge>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SceneFeatures: React.FC = () => {
  const frame = useCurrentFrame();
  const inA = interpolate(frame, [0, 28], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT, opacity: inA }}>
      <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
        <PropertyInspectorPanel />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 300px)", gap: 20 }}>
          <FeatureCard
            icon={<FingerprintIcon />}
            title="Windows Hello"
            detail="Require PIN, fingerprint, or face before an action runs."
          />
          <FeatureCard
            icon={<ShieldIcon />}
            title="DPAPI secrets"
            detail="Sensitive settings are stored outside Stream Deck profiles."
            color={COLORS.green}
          />
          <FeatureCard
            icon={<span style={{ fontSize: 34, fontWeight: 950 }}>HTTP</span>}
            title="Power actions"
            detail="Run apps, scripts, hotkeys, webhooks and text input."
            color={COLORS.blue}
          />
          <FeatureCard
            icon={<span style={{ fontSize: 34, fontWeight: 950 }}>CI</span>}
            title="Release ready"
            detail="Self-contained helper, test coverage and CI packaging."
            color={COLORS.amber}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};

const Closing: React.FC = () => (
  <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", fontFamily: FONT }}>
    <Img src={staticFile("plugin-icon-large.png")} style={{ width: 210, height: 210, marginBottom: 32 }} />
    <div style={{ color: COLORS.text, fontSize: 86, fontWeight: 950, lineHeight: 1 }}>
      SecurePress
    </div>
    <div style={{ marginTop: 20, color: COLORS.muted, fontSize: 31, fontWeight: 720 }}>
      Biometric protection for critical Stream Deck actions
    </div>
    <div style={{ marginTop: 34, display: "flex", gap: 14 }}>
      {["Windows Hello", "DPAPI storage", "Programs", "Scripts", "HTTP", "Text"].map((label) => (
        <Badge key={label}>{label}</Badge>
      ))}
    </div>
  </AbsoluteFill>
);

export const SecurePressPromo: React.FC = () => {
  const frame = useCurrentFrame();
  const heroOpacity = interpolate(frame, [0, 24, 190, 230], [1, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: COLORS.bgBottom }}>
      <Background />
      <Sequence from={0} durationInFrames={240}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", opacity: heroOpacity, fontFamily: FONT }}>
          <div style={{ display: "flex", alignItems: "center", gap: 86 }}>
            <Img src={staticFile("plugin-icon-large.png")} style={{ width: 360, height: 360 }} />
            <HeroText
              title={
                <>
                  Secure your
                  <br />
                  Stream Deck
                </>
              }
              subtitle="Lock critical buttons behind Windows Hello before launching programs, scripts, webhooks or sensitive text."
            />
          </div>
        </AbsoluteFill>
      </Sequence>
      <Sequence from={220} durationInFrames={360}>
        <SceneSetup />
      </Sequence>
      <Sequence from={560} durationInFrames={360}>
        <SceneAuth />
      </Sequence>
      <Sequence from={900} durationInFrames={330}>
        <SceneFeatures />
      </Sequence>
      <Sequence from={1210} durationInFrames={230}>
        <Closing />
      </Sequence>
    </AbsoluteFill>
  );
};

export const SecurePressThumbnail: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Background />
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 86,
        padding: "0 110px",
      }}
    >
      <div
        style={{
          width: 720,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <StreamDeck active="success" scale={0.92} success />
        <div style={{ transform: "scale(0.92)" }}>
          <HelloPrompt progress={1} verified />
        </div>
      </div>
      <HeroText
        badge="Biometric Stream Deck security"
        title={
          <>
            Protect actions
            <br />
            with Windows Hello
          </>
        }
        subtitle="SecurePress gates apps, scripts, hotkeys, HTTP requests and text input behind explicit biometric approval."
      />
    </AbsoluteFill>
  </AbsoluteFill>
);

export const GalleryHero: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Background />
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        padding: "0 110px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 78 }}>
        <StreamDeck active="authenticating" scale={1.1} />
        <div>
          <HeroText
            title={
              <>
                One press.
                <br />
                Then verify.
              </>
            }
            subtitle="Windows Hello appears above your workflow, confirms identity, then SecurePress runs the configured action."
          />
          <div style={{ marginTop: 34, display: "flex", gap: 14 }}>
            <Badge color={COLORS.green}>Prompt on top</Badge>
            <Badge>Session caching</Badge>
            <Badge color={COLORS.amber}>Require every time</Badge>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);

export const GalleryPropertyInspector: React.FC = () => (
  <AbsoluteFill style={{ fontFamily: FONT }}>
    <Background />
    <AbsoluteFill
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 86,
        padding: "0 120px",
      }}
    >
      <PropertyInspectorPanel />
      <div style={{ maxWidth: 680 }}>
        <HeroText
          badge="Configure protected actions"
          title={
            <>
              Choose what runs
              <br />
              after approval
            </>
          }
          subtitle="Programs, scripts, HTTP requests, hotkeys, text input and multi-command sequences share the same Windows Hello gate."
        />
        <div style={{ marginTop: 30, display: "flex", gap: 14, flexWrap: "wrap" }}>
          {["DPAPI-backed sensitive fields", "Validation before auth", "Self-contained helper"].map((label) => (
            <Badge key={label}>{label}</Badge>
          ))}
        </div>
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
