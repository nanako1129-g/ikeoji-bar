import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(circle at 35% 30%, #2a1a0f 0%, #0a0604 70%)",
          color: "#d4af37",
          fontWeight: 900,
        }}
      >
        <div
          style={{
            width: 260,
            height: 300,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            border: "12px solid #d4af37",
            borderRadius: 24,
            position: "relative",
            background:
              "linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(181,106,31,0.35) 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 60,
              width: 120,
              height: 120,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, #f3e5c3 0%, #c9a14a 60%, #6d4a1a 100%)",
              boxShadow: "0 0 60px rgba(212,175,55,0.6)",
            }}
          />
          <div
            style={{
              width: 200,
              height: 90,
              background:
                "linear-gradient(180deg, rgba(181,106,31,0.7) 0%, rgba(212,175,55,0.9) 100%)",
              borderRadius: 12,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 28,
            fontSize: 48,
            letterSpacing: 16,
            color: "#f3e5c3",
          }}
        >
          BAR
        </div>
      </div>
    ),
    { ...size },
  );
}
