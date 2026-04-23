import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
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
            "radial-gradient(circle at 35% 30%, #2a1a0f 0%, #0a0604 75%)",
          color: "#d4af37",
        }}
      >
        <div
          style={{
            width: 90,
            height: 105,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-end",
            border: "5px solid #d4af37",
            borderRadius: 10,
            position: "relative",
            background:
              "linear-gradient(180deg, rgba(212,175,55,0.05) 0%, rgba(181,106,31,0.35) 100%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 22,
              width: 40,
              height: 40,
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 30%, #f3e5c3 0%, #c9a14a 60%, #6d4a1a 100%)",
            }}
          />
          <div
            style={{
              width: 70,
              height: 32,
              background:
                "linear-gradient(180deg, rgba(181,106,31,0.7) 0%, rgba(212,175,55,0.9) 100%)",
              borderRadius: 4,
            }}
          />
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: 16,
            letterSpacing: 6,
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
